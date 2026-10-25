/*
 * Industry Expansion Desk — additive strategy systems for Box Office War.
 * Most systems in the directory already have their own working desks; this
 * module gives them a single entry point and adds ESG, ratings, localization,
 * press relations, rights clearance and production imprints.
 */
(function (root) {
  "use strict";

  const GREEN_PROGRAMS = [
    { id: "solar", name: "Solar Backlot", cost: 18, upkeep: 0.10, rebate: 0.020, score: 14,
      desc: "Put rooftop solar and battery storage on the backlot. A small production credit every shooting week." },
    { id: "reuse", name: "Circular Sets", cost: 32, upkeep: 0.20, rebate: 0.035, score: 23,
      desc: "Reuse set materials, costumes and construction waste across productions." },
    { id: "clean-stage", name: "Low-Carbon Stages", cost: 48, upkeep: 0.30, rebate: 0.045, score: 31,
      desc: "Electrify soundstages and production transport for the strongest emissions score." }
  ];

  const IMPRINTS = [
    { id: "prestige", name: "Prestige Pictures", cost: 16, genres: ["drama", "musical", "war"],
      opening: 0.00, critic: 4, desc: "A craft-first identity for drama, musicals and war pictures." },
    { id: "genre", name: "Midnight Genre", cost: 20, genres: ["horror", "thriller", "scifi", "action"],
      opening: 0.035, critic: 1, desc: "A clear promise for genre fans; strongest on horror, thrillers, sci-fi and action." },
    { id: "family", name: "Wonderlight Family", cost: 16, genres: ["animation", "fantasy", "comedy"],
      opening: 0.025, critic: 2, desc: "A family-facing label for animation, fantasy and comedy." }
  ];

  const LOCALIZATION = {
    subtitles: { name: "Subtitles", cost: 0.008, multiplier: 1.08, desc: "Translated subtitles and local campaign materials." },
    dubbing: { name: "Full dub", cost: 0.018, multiplier: 1.15, desc: "A full local-language dub with stronger audience reach." },
    recut: { name: "Censor-compliant recut", cost: 0.012, multiplier: 1.11, desc: "A territory edit designed to clear local content review." }
  };

  const SYSTEMS = [
    { id: "series", title: "TV Series Production", group: "Create", status: "LIVE", desc: "Pitch pilots, produce seasons, and respond to renewals or cancellations.", tab: "ott" },
    { id: "schedule", title: "Production Scheduling", group: "Create", status: "LIVE", desc: "Track the active slate, shooting phases, release dates and calendar clashes.", tab: "productions" },
    { id: "chemistry", title: "Talent Chemistry & Feuds", group: "Create", status: "LIVE", desc: "Review collaborator chemistry, reunions and active talent feuds.", tab: "develop", sub: "talent" },
    { id: "rewrite", title: "Script Rewrite Room", group: "Create", status: "LIVE", desc: "Polish a pitch or rewrite a pre-production script before cameras roll.", tab: "develop", sub: "scripts" },
    { id: "rights", title: "Legal Rights & Litigation", group: "Protect", status: "EXPANDED", desc: "Clear chain-of-title before production and reduce avoidable plagiarism claims.", anchor: "rights" },
    { id: "piracy", title: "Piracy, Leaks & Cybersecurity", group: "Protect", status: "LIVE", desc: "Monitor piracy pressure, deploy anti-piracy and counter-intelligence measures.", tab: "studio", sub: "operations" },
    { id: "ipo", title: "IPO & Stock Market", group: "Grow", status: "LIVE", desc: "List the studio, report quarterly results and manage shareholder expectations.", tab: "finance", sub: "equity" },
    { id: "academy", title: "Talent Academy", group: "Create", status: "LIVE", desc: "Train eligible performers and develop the next generation of talent.", tab: "develop", sub: "talent" },
    { id: "coproduction", title: "International Co-Productions", group: "Grow", status: "LIVE", desc: "Add an international co-financing partner in the film greenlight room; treaty locations can also lift rebates and prestige.", tab: "develop", sub: "scripts" },
    { id: "labels", title: "Studio Labels", group: "Grow", status: "EXPANDED", desc: "Build specialist production imprints and assign them to upcoming films.", anchor: "labels" },
    { id: "ratings", title: "Film Ratings Board", group: "Release", status: "EXPANDED", desc: "Certify a finished picture or recut an R-rated film for a wider audience.", anchor: "ratings" },
    { id: "press", title: "Entertainment Press Relations", group: "Release", status: "EXPANDED", desc: "Build lasting trade relationships and buy a targeted film press campaign.", anchor: "press" },
    { id: "trends", title: "Dynamic Industry Trends", group: "Grow", status: "LIVE", desc: "Read changing genre heat, recent performance and competitive supply.", tab: "develop", sub: "demographics" },
    { id: "ma", title: "Studio Mergers & Acquisitions", group: "Grow", status: "LIVE", desc: "Acquire catalogues, mini-streamers and distressed rival slates.", tab: "finance", sub: "deals" },
    { id: "unions", title: "Guilds, Unions & Strikes", group: "Protect", status: "LIVE", desc: "Watch labor pressure, negotiate contracts and manage production pauses.", tab: "studio", sub: "operations" },
    { id: "localization", title: "Global Localization & Censorship", group: "Release", status: "EXPANDED", desc: "Choose territory-specific subtitles, dubbing or censor-compliant recuts.", anchor: "localization" },
    { id: "franchise", title: "Franchise Reboots & Legacy Sequels", group: "Grow", status: "LIVE", desc: "Rest a brand, plan a sequel or use a paid reboot to reset franchise fatigue.", tab: "empire", sub: "franchises" },
    { id: "parks", title: "Theme Parks & Immersive Experiences", group: "Grow", status: "LIVE", desc: "Expand hit brands into permanent attractions and destination parks.", tab: "empire", sub: "divisions" },
    { id: "esg", title: "Green Production & ESG", group: "Protect", status: "NEW", desc: "Invest in lower-carbon production for rebates and a stronger sustainability score.", anchor: "esg" },
    { id: "rivals", title: "Smarter Rival Studios", group: "Compete", status: "LIVE", desc: "Study rival strategy, slate moves, alliances and competitive behavior.", tab: "boxoffice" },
    { id: "executives", title: "Executive Hiring", group: "Grow", status: "LIVE", desc: "Recruit studio leadership and build the executive team behind the slate.", tab: "studio", sub: "csuite" },
    { id: "campaigns", title: "Story Campaigns", group: "Play", status: "LIVE", desc: "Start a career with a scenario, goal set and distinct opening conditions.", open: "campaigns" },
    { id: "challenges", title: "Shareable Studio Challenges", group: "Play", status: "LIVE", desc: "Create a seeded challenge code and compare studio results asynchronously.", open: "challenges" },
    { id: "hall", title: "Studio Hall of Fame", group: "Play", status: "LIVE", desc: "Look back on run records, career milestones, releases and box-office highs.", open: "hall" }
  ];

  function dataRef() {
    if (typeof DATA !== "undefined") return DATA;
    return root.DATA || {};
  }
  function round(value, places) {
    const p = Math.pow(10, places == null ? 2 : places);
    return Math.round((Number(value) || 0) * p) / p;
  }
  function clamp(value, lo, hi) {
    const n = Number(value);
    return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
  }
  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }
  function ensure(G) {
    if (!G || typeof G !== "object") return null;
    const s = G.industrySuite || (G.industrySuite = {});
    s.esg = s.esg && typeof s.esg === "object" ? s.esg : { programs: [] };
    if (!Array.isArray(s.esg.programs)) s.esg.programs = [];
    s.press = s.press && typeof s.press === "object" ? s.press : { standing: 32, office: false, campaigns: 0 };
    if (!Number.isFinite(s.press.standing)) s.press.standing = 32;
    s.press.standing = clamp(s.press.standing, 0, 100);
    s.press.office = !!s.press.office;
    if (!Number.isFinite(s.press.campaigns)) s.press.campaigns = 0;
    s.imprints = Array.isArray(s.imprints) ? s.imprints : [];
    s.localizations = s.localizations && typeof s.localizations === "object" ? s.localizations : {};
    s.clearances = s.clearances && typeof s.clearances === "object" ? s.clearances : {};
    s.ratingReviews = s.ratingReviews && typeof s.ratingReviews === "object" ? s.ratingReviews : {};
    return s;
  }
  function persist() {
    try { if (typeof root.saveGame === "function") root.saveGame(); } catch (_) {}
  }
  function log(text, kind) {
    try { if (typeof root.log === "function") root.log(text, kind || ""); } catch (_) {}
  }
  function transact(G, category, amount) {
    const cost = round(Math.max(0, amount), 1);
    if (!G || !G.studio || G.studio.cash + 1e-9 < cost) return false;
    try {
      if (typeof root.spend === "function") root.spend(category || "other", cost);
      else G.studio.cash = round(G.studio.cash - cost, 1);
    } catch (_) { G.studio.cash = round(G.studio.cash - cost, 1); }
    return true;
  }
  function payIncentive(G, amount) {
    const value = round(Math.max(0, amount), 1);
    if (!value) return;
    try {
      if (typeof root.earn === "function") root.earn("incentives", value);
      else G.studio.cash = round(G.studio.cash + value, 1);
    } catch (_) { G.studio.cash = round(G.studio.cash + value, 1); }
  }
  function findProject(G, id) {
    return (G && Array.isArray(G.projects) ? G.projects : []).find(p => String(p.id) === String(id)) || null;
  }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }
  function fail(reason) { return { ok: false, reason: reason || "That action is unavailable." }; }

  function buyGreenProgram(id, G) {
    G = G || root.G;
    const state = ensure(G);
    const def = GREEN_PROGRAMS.find(x => x.id === id);
    if (!state || !def) return fail("Green program not found.");
    if (state.esg.programs.includes(id)) return fail("That sustainability program is already installed.");
    if (!transact(G, "studio", def.cost)) return fail("Need " + def.cost + "M to install " + def.name + ".");
    state.esg.programs.push(id);
    state.esg.installedAt = state.esg.installedAt || G.week;
    log("🌱 " + def.name + " installed (−$" + def.cost + "M). Its weekly upkeep funds cleaner production and qualifies active shoots for production credits.", "good");
    persist();
    return ok({ program: def, score: esgScore(G) });
  }
  function esgScore(G) {
    const state = ensure(G);
    if (!state) return 0;
    return Math.min(100, state.esg.programs.reduce((sum, id) => sum + ((GREEN_PROGRAMS.find(p => p.id === id) || {}).score || 0), 0));
  }
  function esgUpkeep(G) {
    const state = ensure(G);
    if (!state) return 0;
    return round(state.esg.programs.reduce((sum, id) => sum + ((GREEN_PROGRAMS.find(p => p.id === id) || {}).upkeep || 0), 0), 2);
  }
  function greenProductionCredit(project, burn, G) {
    G = G || root.G;
    const state = ensure(G);
    if (!state || !project || project.phase !== "shoot" || !burn) return 0;
    if (state.esg.programs.length && state.esg.activeThisWeek === false) return 0;
    if (project.greenCreditWeek === G.week) return 0;
    const rate = Math.min(0.10, state.esg.programs.reduce((sum, id) => sum + ((GREEN_PROGRAMS.find(p => p.id === id) || {}).rebate || 0), 0));
    if (!rate) return 0;
    const credit = round(burn * rate, 1);
    if (credit <= 0) return 0;
    project.greenCreditWeek = G.week;
    project.greenCredits = round((project.greenCredits || 0) + credit, 1);
    payIncentive(G, credit);
    return credit;
  }

  function openPressOffice(G) {
    G = G || root.G;
    const state = ensure(G);
    if (!state) return fail("No active studio.");
    if (state.press.office) {
      state.press.office = false;
      log("📰 Press office retainer paused. Trade relationships remain on file.", "");
      persist();
      return ok({ active: false });
    }
    const launchCost = 8;
    if (!transact(G, "marketing", launchCost)) return fail("Need $8M to open the press office.");
    state.press.office = true;
    log("📰 Trade press office opened (−$8M, then $0.3M/week). Reporter relationships will strengthen while the retainer is active.", "gold");
    persist();
    return ok({ active: true });
  }
  function runPressCampaign(projectId, campaignId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    const campaigns = {
      junket: { name: "Trade junket", cost: 3, standing: 8, awareness: 0.025, buzz: 0.025, critic: 0 },
      preview: { name: "Critics preview", cost: 5, standing: 11, awareness: 0.015, buzz: 0.015, critic: 3 }
    };
    const def = campaigns[campaignId];
    if (!state || !p || !def) return fail("Choose an active project and a valid press campaign.");
    p.pressCampaigns = Array.isArray(p.pressCampaigns) ? p.pressCampaigns : [];
    if (p.pressCampaigns.includes(campaignId)) return fail("That film already ran this press campaign.");
    if (p.phase === "delivered" || p.phase === "released") return fail("Press campaigns need a project that has not premiered yet.");
    if (campaignId === "preview" && !p.quality) return fail("Critics previews need a finished cut after post-production.");
    if (!transact(G, "marketing", def.cost)) return fail("Need $" + def.cost + "M for the " + def.name.toLowerCase() + ".");
    p.pressCampaigns.push(campaignId);
    p.awareness = round((p.awareness || 0) + def.awareness, 3);
    p.buzzBonus = round((p.buzzBonus || 0) + def.buzz, 3);
    if (p.quality && def.critic) {
      p.quality.critic = clamp((p.quality.critic || 50) + def.critic, 5, 99);
      p.quality.overall = clamp((p.quality.overall || 50) + 1, 5, 99);
    }
    state.press.standing = clamp(state.press.standing + def.standing, 0, 100);
    state.press.campaigns++;
    log("📰 " + def.name + " for “" + p.title + "” (−$" + def.cost + "M). Press standing +" + def.standing + "; the campaign is attached to the release.", "gold");
    persist();
    return ok({ campaign: def, standing: state.press.standing });
  }

  function clearProjectRights(projectId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    if (!state || !p) return fail("Project not found.");
    if (p.rightsClearance && p.rightsClearance.cleared) return fail("Chain-of-title is already cleared.");
    if (p.phase === "released" || p.phase === "delivered") return fail("Rights checks must be completed before release.");
    const cost = round(Math.max(0.5, (p.budget || 0) * 0.012), 1);
    if (!transact(G, "legal", cost)) return fail("Need " + cost + "M for a chain-of-title audit.");
    p.rightsCleared = true;
    p.rightsClearance = { cleared: true, week: G.week, cost };
    state.clearances[String(p.id)] = clone(p.rightsClearance);
    log("⚖ Chain-of-title cleared for “" + p.title + "” (−$" + cost + "M). The audit trail moves with the film.", "good");
    persist();
    return ok({ cost });
  }

  function certifyProject(projectId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    if (!state || !p) return fail("Project not found.");
    if (p.phase !== "ready") return fail("The ratings board can certify a picture after post-production is complete.");
    if (p.ratingReview && p.ratingReview.certified) return fail("This picture already has a certificate.");
    const rating = p.rating === "R" ? "R" : "PG-13";
    p.rating = rating;
    p.ratingReview = { certified: true, rating, week: G.week, method: "standard" };
    state.ratingReviews[String(p.id)] = clone(p.ratingReview);
    log("🎞 Ratings board certified “" + p.title + "” " + rating + ". The certificate is attached to its release file.", "good");
    persist();
    return ok({ rating });
  }
  function recutForRating(projectId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    if (!state || !p) return fail("Project not found.");
    if (p.phase !== "ready" || p.rating !== "R") return fail("Only a finished R-rated picture can be recut for a PG-13 certificate.");
    if (p.releaseWeek && p.releaseWeek <= G.week + 1) return fail("There is not enough time to submit a recut before this release date.");
    const cost = round(Math.max(1, (p.budget || 0) * 0.025), 1);
    if (!transact(G, "production", cost)) return fail("Need " + cost + "M for the board-mandated recut.");
    p.rating = "PG-13";
    p.ratingCut = true;
    p.ratingReview = { certified: true, rating: "PG-13", week: G.week, method: "recut", cost };
    if (p.quality) {
      p.quality.critic = clamp((p.quality.critic || 50) - 3, 5, 99);
      p.quality.overall = clamp((p.quality.overall || 50) - 2, 5, 99);
    }
    state.ratingReviews[String(p.id)] = clone(p.ratingReview);
    log("✂️ “" + p.title + "” recut for a PG-13 certificate (−$" + cost + "M, critics −3). Wider audiences can now attend.", "gold");
    persist();
    return ok({ cost, rating: "PG-13" });
  }

  function localizeProject(projectId, territoryId, packageId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    const territory = (dataRef().TERRITORIES || []).find(t => t.id === territoryId);
    const pkg = LOCALIZATION[packageId];
    if (!state || !p || !territory || !pkg) return fail("Choose a valid project, territory and localization package.");
    if (p.phase === "released" || p.phase === "delivered") return fail("Localization plans close once the film premieres.");
    p.localizationPlans = p.localizationPlans && typeof p.localizationPlans === "object" ? p.localizationPlans : {};
    if (p.localizationPlans[territoryId]) return fail("A localization package is already booked for " + territory.name + ".");
    const cost = round(Math.max(0.5, (p.budget || 0) * pkg.cost), 1);
    if (!transact(G, "marketing", cost)) return fail("Need " + cost + "M for the " + pkg.name.toLowerCase() + " package.");
    const plan = { territory: territoryId, package: packageId, name: pkg.name, multiplier: pkg.multiplier, cost, week: G.week };
    p.localizationPlans[territoryId] = plan;
    state.localizations[String(p.id)] = clone(p.localizationPlans);
    if (packageId === "recut" && territoryId === "china") p.censorCut = true;
    log("🌍 “" + p.title + "” booked " + pkg.name.toLowerCase() + " for " + territory.name + " (−$" + cost + "M, territory demand ×" + pkg.multiplier.toFixed(2) + ").", "gold");
    persist();
    return ok({ cost, plan });
  }

  function createImprint(imprintId, G) {
    G = G || root.G;
    const state = ensure(G), def = IMPRINTS.find(x => x.id === imprintId);
    if (!state || !def) return fail("Studio imprint not found.");
    if (state.imprints.some(x => x.id === imprintId)) return fail("That imprint already exists.");
    if (state.imprints.length >= 3) return fail("The studio can operate three specialist imprints.");
    if (!transact(G, "studio", def.cost)) return fail("Need " + def.cost + "M to launch " + def.name + ".");
    state.imprints.push({ id: def.id, name: def.name, founded: G.week });
    log("🏷️ " + def.name + " launched (−$" + def.cost + "M). Assign a matching picture to earn its audience and critic lift.", "gold");
    persist();
    return ok({ imprint: def });
  }
  function assignImprint(projectId, imprintId, G) {
    G = G || root.G;
    const state = ensure(G), p = findProject(G, projectId);
    const owned = state && state.imprints.find(x => x.id === imprintId);
    const def = IMPRINTS.find(x => x.id === imprintId);
    if (!state || !p || !owned || !def) return fail("Launch that imprint and choose an active project first.");
    if (p.phase === "released" || p.phase === "delivered") return fail("A label cannot be reassigned after release.");
    p.imprint = imprintId;
    log("🏷️ “" + p.title + "” assigned to " + def.name + ".", "good");
    persist();
    return ok({ imprint: def });
  }
  function imprintFor(id) { return IMPRINTS.find(x => x.id === id) || null; }
  function imprintMatches(imprint, genre) { return !!(imprint && imprint.genres.includes(genre)); }
  function openingMultiplier(project, G) {
    G = G || root.G;
    if (!project) return 1;
    let mult = 1;
    const state = ensure(G);
    const def = imprintFor(project.imprint);
    if (def && imprintMatches(def, project.genre)) mult *= (1 + def.opening);
    if (state && project.pressCampaigns && project.pressCampaigns.length) {
      mult *= 1 + Math.min(0.025, Math.max(0, state.press.standing - 32) * 0.00035);
    }
    return mult;
  }
  function applyImprintToFilm(film, G) {
    G = G || root.G;
    const def = imprintFor(film && film.imprint);
    if (!film || !def || !imprintMatches(def, film.genre) || !film.quality) return false;
    film.quality.critic = clamp((film.quality.critic || 50) + def.critic, 5, 99);
    film.quality.overall = clamp((film.quality.overall || 50) + Math.ceil(def.critic / 2), 5, 99);
    film.imprintBonus = { name: def.name, critic: def.critic, opening: def.opening };
    return true;
  }
  function attachReleaseData(project, film) {
    if (!project || !film) return film;
    film.rightsCleared = !!project.rightsCleared;
    film.rightsClearance = clone(project.rightsClearance || null);
    film.ratingReview = clone(project.ratingReview || { certified: true, rating: project.rating || "PG-13", method: "automatic" });
    film.ratingCut = !!project.ratingCut;
    film.localizationPlans = clone(project.localizationPlans || {});
    film.territoryBoost = clone(project.territoryBoost || {});
    film.imprint = project.imprint || null;
    film.pressCampaigns = (project.pressCampaigns || []).slice();
    film.greenCredits = round(project.greenCredits || 0, 1);
    return film;
  }
  function territoryMultiplier(film, territoryId) {
    if (!film) return 1;
    const partner = Number((film.territoryBoost || {})[territoryId]);
    const loc = (film.localizationPlans || {})[territoryId];
    const locMult = Number(loc && loc.multiplier);
    return (Number.isFinite(partner) && partner > 0 ? partner : 1) * (Number.isFinite(locMult) && locMult > 0 ? locMult : 1);
  }
  function internationalMultiplier(film) {
    const territories = dataRef().TERRITORIES || [];
    const intl = territories.filter(t => t.id !== "uscan" && !(t.id === "china" && film && film.chinaDenied));
    let base = 0, adjusted = 0;
    intl.forEach(t => {
      const weight = (Number(t.share) || 0) * (Number((t.genre || {})[film && film.genre]) || 1) * (1 - (Number(t.risk) || 0));
      base += weight;
      adjusted += weight * territoryMultiplier(film, t.id);
    });
    return base > 0 ? clamp(adjusted / base, 0.75, 1.35) : 1;
  }

  function tick(G) {
    G = G || root.G;
    const state = ensure(G);
    if (!state || !G.week) return;
    const upkeep = esgUpkeep(G);
    state.esg.activeThisWeek = !upkeep;
    if (upkeep && G.studio.cash >= upkeep) {
      try { if (typeof root.spend === "function") root.spend("studio", upkeep); else G.studio.cash = round(G.studio.cash - upkeep, 2); }
      catch (_) { G.studio.cash = round(G.studio.cash - upkeep, 2); }
      state.esg.activeThisWeek = true;
      state.esg.upkeepWarned = false;
    } else if (upkeep && !state.esg.upkeepWarned) {
      state.esg.upkeepWarned = true;
      log("🌱 Green production programs paused for the week — cash on hand cannot cover their upkeep.", "bad");
    }
    if (state.press.office) {
      const retainer = 0.3;
      if (G.studio.cash >= retainer) {
        try { if (typeof root.spend === "function") root.spend("marketing", retainer); else G.studio.cash = round(G.studio.cash - retainer, 2); }
        catch (_) { G.studio.cash = round(G.studio.cash - retainer, 2); }
        state.press.standing = clamp(state.press.standing + 0.5, 0, 100);
      } else {
        state.press.office = false;
        log("📰 Press office retainer lapsed — reopen it when liquidity recovers.", "bad");
      }
    }
  }

  function renderDesk(G) {
    G = G || root.G;
    const state = ensure(G);
    if (!state) return "";
    const data = dataRef();
    const esc = typeof root.esc === "function" ? root.esc : (x => String(x == null ? "" : x).replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])));
    const fmtM = typeof root.fmtM === "function" ? root.fmtM : (x => "$" + (Number(x) || 0).toFixed(1) + "M");
    const programs = state.esg.programs;
    const projects = (G.projects || []).filter(p => p.phase !== "delivered" && p.phase !== "released");
    const ready = projects.filter(p => p.phase === "ready");
    const score = esgScore(G);
    const upkeep = esgUpkeep(G);
    const press = state.press;
    const groups = [...new Set(SYSTEMS.map(x => x.group))];
    let html = `<section class="industry-desk">
      <header class="industry-hero"><div><span class="command-eyebrow">STUDIO HQ / INDUSTRY SYSTEMS</span><h2>Every desk. One industry.</h2><p>Open an existing division or take a new step in green production, content clearance, localization and press.</p></div><div class="industry-hero-stat"><small>INDUSTRY SCORE</small><b>${score}<span>/100</span></b><em>${programs.length} green program${programs.length === 1 ? "" : "s"} · ${fmtM(upkeep)}/wk upkeep</em></div></header>
      <div class="industry-system-grid">${groups.map(group => `<section class="industry-system-group"><header><span>${esc(group.toUpperCase())}</span><b>${SYSTEMS.filter(x => x.group === group).length} desks</b></header><div class="industry-system-cards">${SYSTEMS.filter(x => x.group === group).map(item => `<article class="industry-system-card"><div class="industry-system-card-top"><span>${esc(item.group.toUpperCase())}</span><b class="industry-status ${item.status.toLowerCase()}">${esc(item.status)}</b></div><h3>${esc(item.title)}</h3><p>${esc(item.desc)}</p><button class="industry-link" data-industry-open="${esc(item.id)}">Open desk <span aria-hidden="true">↗</span></button></article>`).join("")}</div></section>`).join("")}</div>
      <section class="industry-operations" id="industryESG"><div class="industry-section-head"><div><span class="command-eyebrow">01 / SUSTAINABILITY</span><h3>Green production &amp; ESG</h3><p>Install practical improvements. Each one earns a small credit against active shooting costs.</p></div><div class="industry-kpi"><small>CARBON SCORE</small><b>${score}<span>/100</span></b></div></div><div class="industry-option-grid">${GREEN_PROGRAMS.map(def => { const installed = programs.includes(def.id); return `<article class="industry-option"><header><b>🌱 ${esc(def.name)}</b><span>${installed ? "INSTALLED" : fmtM(def.cost)}</span></header><p>${esc(def.desc)}</p><footer><span>Credit ${(def.rebate * 100).toFixed(1)}% of shoot burn · ${fmtM(def.upkeep)}/wk</span><button class="industry-action" data-esg-program="${def.id}" ${installed || G.studio.cash < def.cost ? "disabled" : ""}>${installed ? "Installed ✓" : "Invest"}</button></footer></article>`; }).join("")}</div></section>
      <section class="industry-operations" id="industryPress"><div class="industry-section-head"><div><span class="command-eyebrow">02 / COMMUNICATIONS</span><h3>Entertainment press relations</h3><p>Build durable trade relationships, then choose which upcoming title gets the coverage.</p></div><div class="industry-kpi"><small>PRESS STANDING</small><b>${Math.round(press.standing)}<span>/100</span></b></div></div><div class="industry-office-row"><div><b>${press.office ? "Press office active" : "No standing retainer"}</b><small>${press.office ? "Maintaining the office costs $0.3M/week and adds 0.5 standing/week." : "Opening costs $8M; an active retainer builds standing over time."}</small></div><button class="industry-action" data-press-office="1">${press.office ? "Pause office" : "Open press office"}</button></div><div class="industry-project-list">${projects.length ? projects.map(p => `<article class="industry-project"><div><b>${esc(p.title)}</b><small>${esc(p.phase || "in development")} · ${esc(p.rating || "PG-13")}${p.pressCampaigns && p.pressCampaigns.length ? " · " + p.pressCampaigns.length + " press campaign(s)" : ""}</small></div><div class="industry-project-actions"><button class="industry-action secondary" data-press-campaign="${p.id}:junket" ${p.pressCampaigns && p.pressCampaigns.includes("junket") ? "disabled" : ""}>Trade junket · $3M</button><button class="industry-action secondary" data-press-campaign="${p.id}:preview" ${p.pressCampaigns && p.pressCampaigns.includes("preview") || !p.quality ? "disabled title='Critics previews need a finished cut'" : ""}>Critics preview · $5M</button></div></article>`).join("") : `<div class="industry-empty">Develop a project to book press coverage.</div>`}</div></section>
      <section class="industry-operations" id="industryLabels"><div class="industry-section-head"><div><span class="command-eyebrow">03 / PRODUCTION BRANDS</span><h3>Studio labels</h3><p>Launch a specialist imprint and assign it to a matching production for a modest opening and critic lift.</p></div><div class="industry-kpi"><small>IMPRINTS</small><b>${state.imprints.length}<span>/3</span></b></div></div><div class="industry-option-grid">${IMPRINTS.map(def => { const owned = state.imprints.some(x => x.id === def.id); return `<article class="industry-option"><header><b>🏷️ ${esc(def.name)}</b><span>${owned ? "ACTIVE" : fmtM(def.cost)}</span></header><p>${esc(def.desc)} Matching genres: ${def.genres.map(x => esc(((data.GENRES || {})[x] || {}).name || x)).join(", ")}.</p><footer><span>${def.critic ? "+" + def.critic + " critic points" : ""}${def.opening ? (def.critic ? " · " : "") + "+" + Math.round(def.opening * 100) + "% opening" : ""}</span><button class="industry-action" data-imprint-create="${def.id}" ${owned || state.imprints.length >= 3 || G.studio.cash < def.cost ? "disabled" : ""}>${owned ? "Active ✓" : "Launch"}</button></footer></article>`; }).join("")}</div>${projects.length && state.imprints.length ? `<div class="industry-project-list">${projects.map(p => `<article class="industry-project"><div><b>${esc(p.title)}</b><small>${esc(((data.GENRES || {})[p.genre] || {}).name || p.genre || "Feature")} · ${p.imprint ? esc((imprintFor(p.imprint) || {}).name || p.imprint) : "no label assigned"}</small></div><div class="industry-project-actions">${state.imprints.map(label => `<button class="industry-action secondary" data-imprint-assign="${p.id}:${label.id}" ${p.imprint === label.id ? "disabled" : ""}>${esc(label.name)}</button>`).join("")}</div></article>`).join("")}</div>` : ""}</section>
      <section class="industry-operations" id="industryRatings"><div class="industry-section-head"><div><span class="command-eyebrow">04 / CLASSIFICATION</span><h3>Film ratings board</h3><p>Certify completed films or trade a few critic points for a broader PG-13 audience.</p></div><div class="industry-kpi"><small>AWAITING REVIEW</small><b>${ready.filter(p => !(p.ratingReview && p.ratingReview.certified)).length}<span> titles</span></b></div></div><div class="industry-project-list">${ready.length ? ready.map(p => { const reviewed = p.ratingReview && p.ratingReview.certified; return `<article class="industry-project"><div><b>${esc(p.title)}</b><small>${reviewed ? "Certified " + esc(p.ratingReview.rating) + " · " + esc(p.ratingReview.method || "standard") : "Awaiting certification"} · ${esc(p.rating || "PG-13")}-rated cut</small></div><div class="industry-project-actions">${!reviewed ? `<button class="industry-action secondary" data-rating-certify="${p.id}">Certify ${esc(p.rating || "PG-13")}</button>` : ""}${!reviewed && p.rating === "R" ? `<button class="industry-action" data-rating-recut="${p.id}" ${p.releaseWeek && p.releaseWeek <= G.week + 1 ? "disabled title='Too close to the release date'" : ""}>Recut to PG-13</button>` : ""}</div></article>`; }).join("") : `<div class="industry-empty">Finished films waiting for a release date will appear here.</div>`}</div></section>
      <section class="industry-operations" id="industryLocalization"><div class="industry-section-head"><div><span class="command-eyebrow">05 / GLOBAL DISTRIBUTION</span><h3>Localization &amp; censorship</h3><p>Book a territory-specific package before release. Local plans boost that market's share of the theatrical gross.</p></div><div class="industry-kpi"><small>MARKETS</small><b>${((data.TERRITORIES) || []).length}<span> territories</span></b></div></div><div class="industry-project-list">${projects.length ? projects.map(p => { const booked = p.localizationPlans || {}; const territories = (data.TERRITORIES || []).filter(t => t.id !== "uscan" && !booked[t.id]).slice(0, 3); return `<article class="industry-project"><div><b>${esc(p.title)}</b><small>${Object.keys(booked).length ? Object.values(booked).map(x => esc(x.name) + " · " + esc(((data.territory || (() => null))(x.territory) || {}).name || x.territory)).join("; ") : "No territory packages booked"}</small></div><div class="industry-project-actions">${territories.map(t => `<select class="industry-select" aria-label="Localization package for ${esc(p.title)} in ${esc(t.name)}" data-loc-package="${p.id}:${t.id}"><option value="">${esc(t.emoji)} ${esc(t.name)} · package…</option>${Object.entries(LOCALIZATION).map(([key, pkg]) => `<option value="${key}">${esc(pkg.name)} · ×${pkg.multiplier.toFixed(2)}</option>`).join("")}</select><button class="industry-action secondary" data-localize="${p.id}:${t.id}" disabled>Book</button>`).join("")}</div></article>`; }).join("") : `<div class="industry-empty">Upcoming projects will appear here before their theatrical release.</div>`}</div></section>
      <section class="industry-operations" id="industryRights"><div class="industry-section-head"><div><span class="command-eyebrow">06 / LEGAL</span><h3>Rights clearance</h3><p>Order a chain-of-title audit before release to reduce the odds of an avoidable plagiarism claim.</p></div><div class="industry-kpi"><small>CLEARED</small><b>${projects.filter(p => p.rightsCleared).length}<span> / ${projects.length}</span></b></div></div><div class="industry-project-list">${projects.length ? projects.map(p => `<article class="industry-project"><div><b>${esc(p.title)}</b><small>${p.rightsCleared ? "Chain-of-title audited · " + esc((p.rightsClearance || {}).week ? "week " + p.rightsClearance.week : "clear") : "No clearance audit on file"} · ${fmtM(Math.max(0.5, (p.budget || 0) * 0.012))}</small></div><button class="industry-action secondary" data-rights-clear="${p.id}" ${p.rightsCleared ? "disabled" : ""}>${p.rightsCleared ? "Cleared ✓" : "Clear rights"}</button></article>`).join("") : `<div class="industry-empty">Greenlight a picture to request chain-of-title clearance.</div>`}</div></section>
    </section>`;
    return html;
  }

  function system(id) { return SYSTEMS.find(x => x.id === id) || null; }

  root.IndustryExpansion = {
    GREEN_PROGRAMS, IMPRINTS, LOCALIZATION, SYSTEMS,
    ensure, tick, renderDesk, system, esgScore, esgUpkeep,
    buyGreenProgram, greenProductionCredit, openPressOffice, runPressCampaign,
    clearProjectRights, certifyProject, recutForRating, localizeProject,
    createImprint, assignImprint, openingMultiplier, applyImprintToFilm,
    attachReleaseData, territoryMultiplier, internationalMultiplier
  };
})(typeof window !== "undefined" ? window : globalThis);
