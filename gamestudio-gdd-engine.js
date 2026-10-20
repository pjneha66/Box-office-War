/* ═════════════════════════════════════════════════════════════════════════
   GAMESTUDIO-GDD-ENGINE.JS — 8-Phase GDD, Custom Game Engine & Review Outlets
   Box Office War — Modular Engine Extension
   Synthesized from Reference: Game Dev Story (v2.6.9) & Game Dev Tycoon (v1.6.18)
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

  // 1. Topics & Genres with Synergies (From Game Dev Story / Tycoon)
  const TOPICS = [
    { id: "cyberpunk", name: "Cyberpunk", devCost: 1.5, audienceBonus: { young: 1.2, mature: 1.4, everyone: 0.8 } },
    { id: "fantasy", name: "Fantasy", devCost: 1.2, audienceBonus: { young: 1.1, mature: 1.1, everyone: 1.3 } },
    { id: "scifi", name: "Sci-Fi Space", devCost: 1.4, audienceBonus: { young: 1.0, mature: 1.3, everyone: 1.1 } },
    { id: "zombie", name: "Zombie Survival", devCost: 1.0, audienceBonus: { young: 1.3, mature: 1.5, everyone: 0.6 } },
    { id: "medieval", name: "Medieval Warfare", devCost: 1.3, audienceBonus: { young: 0.9, mature: 1.4, everyone: 1.0 } },
    { id: "superhero", name: "Superhero", devCost: 1.8, audienceBonus: { young: 1.5, mature: 1.2, everyone: 1.4 } },
    { id: "sports", name: "Championship Sports", devCost: 0.8, audienceBonus: { young: 1.3, mature: 1.0, everyone: 1.5 } },
    { id: "mystery", name: "Detective Mystery", devCost: 0.7, audienceBonus: { young: 0.8, mature: 1.5, everyone: 0.9 } },
    { id: "anime", name: "Mecha Anime", devCost: 1.1, audienceBonus: { young: 1.4, mature: 1.1, everyone: 1.0 } },
    { id: "racing", name: "Street Racing", devCost: 0.9, audienceBonus: { young: 1.4, mature: 1.2, everyone: 1.2 } }
  ];

  const GENRES = [
    { id: "action", name: "Action", techWeight: 0.6, designWeight: 0.4 },
    { id: "rpg", name: "RPG", techWeight: 0.4, designWeight: 0.6 },
    { id: "simulation", name: "Simulation", techWeight: 0.7, designWeight: 0.3 },
    { id: "adventure", name: "Adventure", techWeight: 0.3, designWeight: 0.7 },
    { id: "strategy", name: "Strategy", techWeight: 0.65, designWeight: 0.35 },
    { id: "casual", name: "Casual Party", techWeight: 0.2, designWeight: 0.8 }
  ];

  // Synergy Matrix (1.0 = normal, 1.4+ = legendary, <0.8 = bad combo)
  const SYNERGIES = {
    "cyberpunk:action": 1.45, "cyberpunk:rpg": 1.50, "cyberpunk:strategy": 1.15, "cyberpunk:casual": 0.55,
    "fantasy:rpg": 1.55, "fantasy:adventure": 1.40, "fantasy:action": 1.30, "fantasy:simulation": 0.75,
    "scifi:strategy": 1.45, "scifi:action": 1.35, "scifi:rpg": 1.25, "scifi:casual": 0.70,
    "zombie:action": 1.45, "zombie:adventure": 1.35, "zombie:simulation": 0.85, "zombie:casual": 0.60,
    "medieval:strategy": 1.50, "medieval:rpg": 1.40, "medieval:action": 1.25, "medieval:casual": 0.65,
    "superhero:action": 1.55, "superhero:adventure": 1.30, "superhero:rpg": 1.20, "superhero:casual": 1.00,
    "sports:simulation": 1.50, "sports:action": 1.25, "sports:casual": 1.20, "sports:rpg": 0.60,
    "mystery:adventure": 1.50, "mystery:rpg": 1.20, "mystery:action": 0.85, "mystery:casual": 0.75,
    "anime:action": 1.40, "anime:rpg": 1.45, "anime:adventure": 1.25, "anime:simulation": 0.80,
    "racing:action": 1.35, "racing:simulation": 1.40, "racing:casual": 1.20, "racing:rpg": 0.60
  };

  // 2. Custom Game Engine Builder Modules (From Game Dev Tycoon)
  const ENGINE_TECH_MODULES = [
    { id: "gfx_2d_hires", name: "2D High-Res Pixel Engine", cost: 1.5, rp: 30, techBonus: 10, designBonus: 15 },
    { id: "physics_basic", name: "Ragdoll Collision Physics", cost: 2.0, rp: 45, techBonus: 18, designBonus: 5 },
    { id: "branching_dialogue", name: "Dynamic Branching Dialogue Trees", cost: 1.2, rp: 40, techBonus: 8, designBonus: 22 },
    { id: "gfx_3d_voxel", name: "3D Voxel Real-time Engine", cost: 3.5, rp: 65, techBonus: 25, designBonus: 15 },
    { id: "spatial_audio", name: "Binaural 3D Surround Audio", cost: 1.8, rp: 50, techBonus: 12, designBonus: 20 },
    { id: "ray_tracing", name: "Ray-Traced Global Illumination", cost: 6.0, rp: 100, techBonus: 40, designBonus: 20 },
    { id: "open_world_stream", name: "Seamless Open-World Streaming", cost: 5.0, rp: 90, techBonus: 35, designBonus: 25 },
    { id: "esports_netcode", name: "Sub-Tick Deterministic Netcode", cost: 4.0, rp: 80, techBonus: 38, designBonus: 10 }
  ];

  // 3. Fictional Gaming Press Outlets (Reviews 1-10)
  const REVIEW_OUTLETS = [
    { id: "game_hero", name: "Game Hero Magazine", bias: "gameplay", quoteHigh: "An undisputed masterpiece of genre craftsmanship!", quoteLow: "A clumsy mess with uninspired mechanics." },
    { id: "pixel_gamer", name: "Pixel Gamer Weekly", bias: "graphics", quoteHigh: "Visual sorcery! Sets a brand new benchmark.", quoteLow: "Looks dated and stutters at every turn." },
    { id: "all_games_mag", name: "All Games Global", bias: "story", quoteHigh: "Narrative brilliance that keeps you glued to the screen.", quoteLow: "Shallow writing and forgettable characters." },
    { id: "daily_byte", name: "Daily Byte Esports", bias: "tech", quoteHigh: "Technical perfection with ultra-tight performance.", quoteLow: "Riddled with bugs and terrible frame pacing." }
  ];

  // 4. Game Conventions & Expos (G-Pha / GameCon)
  const GAME_CONVENTIONS = [
    { id: "indie_kiosk", name: "Indie Corner Kiosk", cost: 0.5, hypeGain: 15, wishlistGain: 25000, desc: "A cozy booth on the show floor. Great buzz per dollar." },
    { id: "hall_booth", name: "Main Hall Themed Booth", cost: 2.5, hypeGain: 35, wishlistGain: 85000, desc: "Interactive demo stations, cosplayers, and tournament stage." },
    { id: "keynote_arena", name: "Center Arena Keynote Showcase", cost: 8.0, hypeGain: 80, wishlistGain: 250000, desc: "A 45-minute live stadium reveal with worldwide livestream broadcast." }
  ];

  // 5. State Initialization
  function _ensureState(G){
    if(!G) return;
    if(!G.gameStudio) G.gameStudio = {};
    const gs = G.gameStudio;
    if(gs.researchPoints == null) gs.researchPoints = 120; // Initial RP
    if(!gs.customEngines) gs.customEngines = [
      { id: "legacy_engine_v1", name: "Titan 2D Engine v1.0", modules: ["gfx_2d_hires"], techBonus: 10, designBonus: 15, level: 1 }
    ];
    if(!gs.activeEngine) gs.activeEngine = "legacy_engine_v1";
    if(!gs.gddProjects) gs.gddProjects = [];
    if(!gs.completedTitles) gs.completedTitles = [];
    if(!gs.unlockedTopics) gs.unlockedTopics = ["cyberpunk", "fantasy", "scifi", "sports"];
    if(!gs.conventionsBooked) gs.conventionsBooked = [];
  }

  // 6. GDD Greenlight Engine
  function greenlightGddGame(opts){
    const G = _getG();
    if(!G) return { ok: false, msg: "Game state not found." };
    _ensureState(G);

    const title = opts.title || "Project " + (G.gameStudio.gddProjects.length + 1);
    const topic = TOPICS.find(t => t.id === opts.topicId) || TOPICS[0];
    const genre = GENRES.find(g => g.id === opts.genreId) || GENRES[0];
    const audience = opts.audience || "everyone"; // young, mature, everyone
    const targetPlatform = opts.platform || "cyberdeck_pc";
    const engine = G.gameStudio.customEngines.find(e => e.id === opts.engineId) || G.gameStudio.customEngines[0];

    const baseCost = Math.round((4.0 * topic.devCost) * 10) / 10;
    if((G.studio ? G.studio.cash : G.cash) < baseCost){
      return { ok: false, msg: "Insufficient cash for GDD development (" + baseCost + "M required)." };
    }

    _modCash(G, -baseCost);

    const synergyKey = topic.id + ":" + genre.id;
    const synergy = SYNERGIES[synergyKey] || 1.0;
    const audBonus = (topic.audienceBonus && topic.audienceBonus[audience]) || 1.0;

    const project = {
      id: "gdd_" + Date.now(),
      title: title,
      topic: topic,
      genre: genre,
      audience: audience,
      platform: targetPlatform,
      engine: engine,
      synergy: synergy,
      audBonus: audBonus,
      budget: baseCost,
      currentPhase: 1, // 1 to 8
      phaseNames: [
        "1. Concept & Pitch",
        "2. GDD Architecture",
        "3. Core Engine Pipeline",
        "4. Alpha Milestone",
        "5. Content & World Polish",
        "6. Beta QA Bug Squashing",
        "7. Gold Master Stamping",
        "8. Review Press & Launch"
      ],
      progress: 0,
      totalWeeks: 8,
      weeksLeft: 8,
      techPoints: Math.round(30 + (engine.techBonus || 10) + (genre.techWeight * 40)),
      designPoints: Math.round(30 + (engine.designBonus || 10) + (genre.designWeight * 40)),
      bugs: Math.max(2, Math.round(18 - (engine.level * 2))),
      hype: 20
    };

    G.gameStudio.gddProjects.push(project);
    if(typeof log === "function"){
      log("🎮 Greenlit GDD Title: \"" + title + "\" (" + topic.name + " " + genre.name + ") on " + engine.name + ". Budget: $" + baseCost + "M.", "gold");
    }

    return { ok: true, project: project };
  }

  // 7. Advance GDD Weekly Tick
  function tickGddEngine(){
    const G = _getG();
    if(!G || !G.gameStudio || !G.gameStudio.gddProjects || !G.gameStudio.gddProjects.length) return;
    const gs = G.gameStudio;

    const completed = [];
    gs.gddProjects.forEach(p => {
      p.weeksLeft--;
      p.currentPhase = Math.min(8, 9 - p.weeksLeft);
      p.progress = Math.round(((8 - p.weeksLeft) / 8) * 100);

      // Accumulate tech, design, squashed bugs
      p.techPoints += Math.round(5 + Math.random() * 8);
      p.designPoints += Math.round(5 + Math.random() * 8);
      if(p.currentPhase >= 5 && p.bugs > 0){
        p.bugs = Math.max(0, p.bugs - Math.round(2 + Math.random() * 3));
      }

      if(p.weeksLeft <= 0){
        completed.push(p);
      }
    });

    completed.forEach(p => {
      finishGddLaunch(p);
    });

    gs.gddProjects = gs.gddProjects.filter(p => !completed.includes(p));
  }

  // 8. Launch & Reviews Calculation
  function finishGddLaunch(p){
    const G = _getG();
    if(!G) return;
    const gs = G.gameStudio;

    // Review Math from Game Dev Tycoon: Quality depends on Synergy, Tech/Design balance, Bug-free status
    const rawScore = ((p.techPoints + p.designPoints) / 2) * p.synergy * p.audBonus;
    const bugPenalty = p.bugs * 2.5;
    const finalScore = Math.min(99, Math.max(25, Math.round((rawScore - bugPenalty) * 0.45)));

    // Generate 4 reviews
    const reviews = REVIEW_OUTLETS.map(outlet => {
      let score = Math.min(10, Math.max(2, Math.round((finalScore / 10) + (Math.random() * 1.6 - 0.8))));
      const quote = score >= 8 ? outlet.quoteHigh : outlet.quoteLow;
      return { outlet: outlet.name, score: score, quote: quote };
    });

    // Economics: Launch Box Office / Game Sales
    const totalSalesM = Math.round((finalScore / 100) * (30 + p.hype * 0.4) * p.synergy * 10) / 10;
    const launchWeekend = Math.round(totalSalesM * 0.4 * 10) / 10;
    const weeklyTail = Math.round((totalSalesM - launchWeekend) / 12 * 10) / 10;

    _modCash(G, launchWeekend);

    const rpEarned = Math.round(15 + (finalScore * 0.4));
    gs.researchPoints = (gs.researchPoints || 0) + rpEarned;

    const record = {
      id: p.id,
      title: p.title,
      topic: p.topic.name,
      genre: p.genre.name,
      engine: p.engine.name,
      score: finalScore,
      reviews: reviews,
      salesTotal: totalSalesM,
      earned: launchWeekend,
      weeklyTail: weeklyTail,
      weeksLeft: 12,
      rpEarned: rpEarned,
      whenWeek: G.week || 1
    };

    gs.completedTitles.unshift(record);

    if(typeof log === "function"){
      log("🏆 Gold Master Shipped: \"" + p.title + "\" scores " + finalScore + "/100! Launch Weekend: +$" + launchWeekend + "M. Earned +" + rpEarned + " Research Points.", "gold");
    }
  }

  // 9. Build Custom Game Engine
  function buildCustomEngine(name, selectedModuleIds){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureState(G);

    const modules = ENGINE_TECH_MODULES.filter(m => selectedModuleIds.includes(m.id));
    if(!modules.length) return { ok: false, msg: "Select at least 1 engine module." };

    const totalCost = modules.reduce((sum, m) => sum + m.cost, 0);
    const totalRp = modules.reduce((sum, m) => sum + m.rp, 0);

    if((G.studio ? G.studio.cash : G.cash) < totalCost){
      return { ok: false, msg: "Insufficient funds: $" + totalCost + "M required." };
    }
    if((G.gameStudio.researchPoints || 0) < totalRp){
      return { ok: false, msg: "Insufficient Research Points: " + totalRp + " RP required." };
    }

    _modCash(G, -totalCost);
    G.gameStudio.researchPoints -= totalRp;

    const techBonus = modules.reduce((sum, m) => sum + m.techBonus, 0);
    const designBonus = modules.reduce((sum, m) => sum + m.designBonus, 0);

    const newEngine = {
      id: "engine_" + Date.now(),
      name: name || "Custom Engine v" + (G.gameStudio.customEngines.length + 1),
      modules: modules.map(m => m.id),
      techBonus: techBonus,
      designBonus: designBonus,
      level: G.gameStudio.customEngines.length + 1,
      cost: totalCost
    };

    G.gameStudio.customEngines.push(newEngine);
    G.gameStudio.activeEngine = newEngine.id;

    if(typeof log === "function"){
      log("🛠 Developed Custom Engine: \"" + newEngine.name + "\" (+ " + techBonus + " Tech, +" + designBonus + " Design)!", "gold");
    }

    return { ok: true, engine: newEngine };
  }

  // 10. Book Convention Booth (G-Pha / GameCon)
  function bookConventionBooth(conId, projectId){
    const G = _getG();
    if(!G) return { ok: false, msg: "State missing" };
    _ensureState(G);

    const con = GAME_CONVENTIONS.find(c => c.id === conId);
    const project = G.gameStudio.gddProjects.find(p => p.id === projectId);
    if(!con || !project) return { ok: false, msg: "Invalid convention or project." };

    if((G.studio ? G.studio.cash : G.cash) < con.cost){
      return { ok: false, msg: "Insufficient funds for convention showcase." };
    }

    _modCash(G, -con.cost);
    project.hype = (project.hype || 20) + con.hypeGain;
    G.gameStudio.conventionsBooked.push({ conId: con.id, projectTitle: project.title, when: G.week });

    if(typeof log === "function"){
      log("🎪 GameCon Showcase: \"" + project.title + "\" presented at " + con.name + "! +" + con.hypeGain + " Hype, +" + con.wishlistGain.toLocaleString() + " Wishlists.", "gold");
    }

    return { ok: true, con: con, newHype: project.hype };
  }

  // 11. Interactive Modal Renders
  function openGddModal(){
    const G = _getG();
    if(!G) return;
    _ensureState(G);

    let h = `
      <div class="modal-head">
        <h3>🎮 8-Phase GDD Studio — Greenlight Title</h3>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding-right:8px">
        <p class="small muted">Synthesized from <b>Game Dev Story</b> &amp; <b>Game Dev Tycoon</b>. Craft your title, pair Topic with Genre for synergy, pick your target audience, and assign a proprietary game engine.</p>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:4px">Game Title</div>
          <input type="text" id="gddTitleInput" value="Cyber Odyssey 2099" style="width:100%;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid #444;color:#fff;font-weight:700">
        </div>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:6px">Select Topic (Subject)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:6px">
            ${TOPICS.map((t, idx) => `
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px">
                <input type="radio" name="gddTopic" value="${t.id}" ${idx===0?"checked":""}>
                <span>${t.name}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:6px">Select Genre</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(130px, 1fr));gap:6px">
            ${GENRES.map((g, idx) => `
              <label style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px">
                <input type="radio" name="gddGenre" value="${g.id}" ${idx===0?"checked":""}>
                <span>${g.name}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:6px">Target Demographic</div>
          <div style="display:flex;gap:12px">
            <label style="font-size:12px;cursor:pointer"><input type="radio" name="gddAudience" value="young"> Young (Kids/Teens)</label>
            <label style="font-size:12px;cursor:pointer"><input type="radio" name="gddAudience" value="everyone" checked> Everyone (Broad)</label>
            <label style="font-size:12px;cursor:pointer"><input type="radio" name="gddAudience" value="mature"> Mature (18+ Hardcore)</label>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:6px">Proprietary Game Engine</div>
          <select id="gddEngineSelect" style="width:100%;padding:8px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid #444;color:#fff">
            ${G.gameStudio.customEngines.map(e => `
              <option value="${e.id}">${e.name} (+${e.techBonus} Tech, +${e.designBonus} Design)</option>
            `).join("")}
          </select>
        </div>

        <div class="card" style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3)">
          <div class="spread">
            <div>
              <b>Research Points: <span style="color:#38ef7d">${G.gameStudio.researchPoints || 0} RP</span></b>
              <div class="tiny muted">Earned from Gold Master post-mortems and review praise.</div>
            </div>
            <button class="btn btn-sm btn-alt" onclick="GameStudioGdd.openEngineBuilderModal()">🛠 Build New Engine</button>
          </div>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="gddSubmitBtn">🚀 Greenlight 8-Phase GDD</button>
      </div>
    `;

    openModal(h);

    const submitBtn = document.getElementById("gddSubmitBtn");
    if(submitBtn){
      submitBtn.onclick = function(){
        const title = document.getElementById("gddTitleInput").value;
        const topicRadio = document.querySelector("input[name='gddTopic']:checked");
        const genreRadio = document.querySelector("input[name='gddGenre']:checked");
        const audRadio = document.querySelector("input[name='gddAudience']:checked");
        const engineSelect = document.getElementById("gddEngineSelect");

        const res = greenlightGddGame({
          title: title,
          topicId: topicRadio ? topicRadio.value : "cyberpunk",
          genreId: genreRadio ? genreRadio.value : "action",
          audience: audRadio ? audRadio.value : "everyone",
          engineId: engineSelect ? engineSelect.value : null
        });

        if(!res.ok){
          if(typeof toast === "function") toast(res.msg, "bad");
          else alert(res.msg);
          return;
        }

        closeModal();
        if(typeof render === "function") render();
        if(typeof toast === "function") toast("GDD Greenlit: " + title, "good");
      };
    }
  }

  function openEngineBuilderModal(){
    const G = _getG();
    if(!G) return;
    _ensureState(G);

    let h = `
      <div class="modal-head">
        <h3>🛠 Custom Game Engine Builder (Game Dev Tycoon)</h3>
      </div>
      <div class="modal-body" style="max-height:75vh;overflow-y:auto;padding-right:8px">
        <p class="small muted">Architect your studio's next-gen game engine. Invest capital and Research Points (RP) to bundle modern rendering, physics, and AI audio modules.</p>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:4px">Engine Name</div>
          <input type="text" id="engNameInput" value="Titan RayTracer v${G.gameStudio.customEngines.length + 1}" style="width:100%;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid #444;color:#fff;font-weight:700">
        </div>

        <div class="card" style="margin-bottom:12px">
          <div class="small muted" style="margin-bottom:8px">Select Engine Modules</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${ENGINE_TECH_MODULES.map(m => `
              <label style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);padding:8px 12px;border-radius:8px;cursor:pointer">
                <div style="display:flex;align-items:center;gap:8px">
                  <input type="checkbox" name="engModule" value="${m.id}">
                  <div>
                    <b>${m.name}</b>
                    <div class="tiny muted">+${m.techBonus} Tech · +${m.designBonus} Design</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <span style="color:#d4af37;font-weight:700">$${m.cost}M</span>
                  <div class="tiny" style="color:#38ef7d">${m.rp} RP</div>
                </div>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="card" style="background:rgba(0,0,0,0.25)">
          <div class="spread">
            <span>Available Research Points:</span>
            <b style="color:#38ef7d">${G.gameStudio.researchPoints || 0} RP</b>
          </div>
        </div>
      </div>

      <div class="modal-actions" style="margin-top:16px">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="engBuildSubmitBtn">🔨 Compile Engine</button>
      </div>
    `;

    openModal(h);

    const submitBtn = document.getElementById("engBuildSubmitBtn");
    if(submitBtn){
      submitBtn.onclick = function(){
        const name = document.getElementById("engNameInput").value;
        const checked = [...document.querySelectorAll("input[name='engModule']:checked")].map(cb => cb.value);

        const res = buildCustomEngine(name, checked);
        if(!res.ok){
          if(typeof toast === "function") toast(res.msg, "bad");
          else alert(res.msg);
          return;
        }

        closeModal();
        if(typeof render === "function") render();
        if(typeof toast === "function") toast("Engine Compiled: " + name, "good");
      };
    }
  }

  // Export module
  const GameStudioGdd = {
    TOPICS: TOPICS,
    GENRES: GENRES,
    SYNERGIES: SYNERGIES,
    ENGINE_TECH_MODULES: ENGINE_TECH_MODULES,
    REVIEW_OUTLETS: REVIEW_OUTLETS,
    GAME_CONVENTIONS: GAME_CONVENTIONS,
    greenlightGddGame: greenlightGddGame,
    tickGddEngine: tickGddEngine,
    buildCustomEngine: buildCustomEngine,
    bookConventionBooth: bookConventionBooth,
    openGddModal: openGddModal,
    openEngineBuilderModal: openEngineBuilderModal
  };

  if(typeof module !== "undefined" && module.exports){
    module.exports = GameStudioGdd;
  }
  global.GameStudioGdd = GameStudioGdd;
  global.openGddModal = openGddModal;
  global.openEngineBuilderModal = openEngineBuilderModal;

})(typeof window !== "undefined" ? window : global);
