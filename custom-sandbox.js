/* ═════════════════════════════════════════════════════════════════════════
   CUSTOM-SANDBOX.JS — Custom Database Sandbox & Holiday Release Calendar
   Box Office War — Modular Engine Extension
   (Synthesized with 100% parity to Box Office Sim 2 Custom Database & Holiday Systems)
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_SANDBOX = {
    version: "1.0.0",

    HOLIDAY_CORRIDORS: [
      { week: 1, name: "New Year Holiday Afterglow", mult: 1.25, badge: "Winter Spike", desc: "Holiday school breaks drive massive family and holdover cinema traffic." },
      { week: 7, name: "Presidents' Day & Valentine's Weekend", mult: 1.20, badge: "Romance / Thriller Peak", desc: "Couples and long-weekend date night corridor." },
      { week: 18, name: "Summer Blockbuster Kickoff Corridor", mult: 1.35, badge: "Summer Tentpole", desc: "High-octane comic book and blockbuster season premiere." },
      { week: 26, name: "Independence Day / Mid-Summer Peak", mult: 1.40, badge: "Peak Summer", desc: "Highest single-weekend four-quadrant theater attendance of the year." },
      { week: 35, name: "Labor Day Extended Weekend", mult: 1.15, badge: "Summer Finale", desc: "Final push for late-summer sleeper hits and counterprogramming." },
      { week: 43, name: "Halloween Horror Corridor", mult: 1.30, badge: "Horror / Thriller Spike", desc: "Massive box office multiplier for horror, slasher, and supernatural releases." },
      { week: 47, name: "Thanksgiving Family Corridor", mult: 1.50, badge: "Thanksgiving Surge", desc: "Five-day weekend driving massive animated and four-quadrant box office." },
      { week: 51, name: "Christmas & Holiday Mega-Corridor", mult: 1.60, badge: "Holiday Megacorridor", desc: "The crown jewel of the box office calendar with unprecedented second-week legs." }
    ],

    QUIRKS: [
      { id: "box_office_magnet", name: "Box Office Magnet", desc: "+20% opening weekend box office boost." },
      { id: "method_actor", name: "Method Actor", desc: "+15 craft score; occasional shoot delays." },
      { id: "oscar_bait", name: "Oscar Bait", desc: "+25 awards campaign traction and critical appeal." },
      { id: "speed_demon", name: "Speed Demon", desc: "Completes production 2 weeks faster." },
      { id: "perfectionist", name: "Perfectionist", desc: "+12 overall quality; +10% budget overrun risk." },
      { id: "diva", name: "Diva Demands", desc: "Demands 25% higher fee; attracts massive tabloid buzz." }
    ],

    _getG(state){
      if(state) return state;
      if(typeof G !== "undefined") return G;
      if(typeof global !== "undefined" && global.G) return global.G;
      if(typeof window !== "undefined" && window.G) return window.G;
      return null;
    },

    // Create Custom Talent (Actor or Director)
    createCustomTalent(data, optState){
      const g = this._getG(optState);
      if(!g || !data || !data.name) return false;

      const newId = 90000 + Math.floor(Math.random() * 9000);
      const talentObj = {
        id: newId,
        name: data.name.trim(),
        kind: data.kind || "actor", // actor or director
        power: Math.min(5, Math.max(1, parseInt(data.power || 3, 10))),
        skill: Math.min(99, Math.max(40, parseInt(data.skill || 70, 10))),
        starPower: Math.min(99, Math.max(40, parseInt(data.starPower || 70, 10))),
        favGenre: data.favGenre || "action",
        quirk: data.quirk || "box_office_magnet",
        custom: true,
        age: parseInt(data.age || 32, 10),
        demand: 80,
        bookedUntil: 0
      };

      g.talent = g.talent || [];
      g.talent.unshift(talentObj);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(logFn){
        logFn("🧪 CUSTOM TALENT ADDED: " + talentObj.name + " (" + talentObj.power + " Star " + talentObj.kind + ") registered to industry database.", "good");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Create Custom Rival Studio
    createCustomRival(data, optState){
      const g = this._getG(optState);
      if(!g || !data || !data.name) return false;

      const rivalObj = {
        name: data.name.trim(),
        color: data.color || "#00e5ff",
        style: data.style || "tentpole",
        blurb: data.blurb || "Custom rival studio powerhouse",
        cash: parseInt(data.cash || 300, 10),
        rep: parseInt(data.rep || 60, 10),
        slate: [],
        ytd: 0,
        custom: true
      };

      g.rivals = g.rivals || [];
      g.rivals.push(rivalObj);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(logFn){
        logFn("🧪 CUSTOM RIVAL FOUNDED: " + rivalObj.name + " (" + rivalObj.style + ") entered the studio wars.", "gold");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Create Custom Franchise
    createCustomFranchise(data, optState){
      const g = this._getG(optState);
      if(!g || !data || !data.name) return false;

      const frObj = {
        id: "fr_cust_" + Date.now(),
        name: data.name.trim(),
        genre: data.genre || "action",
        tier: parseInt(data.tier || 1, 10),
        decay: Math.min(1.0, Math.max(0.1, parseFloat(data.decay || 0.85))),
        lore: data.lore || "A celebrated multi-film cinematic legacy.",
        entries: [],
        fanBase: 12.0,
        custom: true
      };

      g.franchises = g.franchises || [];
      g.franchises.push(frObj);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(logFn){
        logFn("🧪 CUSTOM FRANCHISE CREATED: \"" + frObj.name + "\" IP added to studio vault.", "gold");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    },

    // Create Custom Screenplay / Idea
    createCustomIdea(data, optState){
      const g = this._getG(optState);
      if(!g || !data || !data.title) return false;

      const ideaObj = {
        id: "idea_cust_" + Date.now(),
        title: data.title.trim(),
        genre: data.genre || "action",
        scale: data.scale || "mid",
        concept: data.concept || "High-concept original screenplay",
        buzz: parseInt(data.buzz || 70, 10),
        quality: { overall: parseInt(data.quality || 75, 10), craft: 75, script: 75 },
        custom: true
      };

      g.ideas = g.ideas || [];
      g.ideas.unshift(ideaObj);

      const logFn = (typeof log === "function") ? log : ((typeof global !== "undefined" && typeof global.log === "function") ? global.log : null);
      if(logFn){
        logFn("🧪 CUSTOM SCRIPT COMMISSIONED: \"" + ideaObj.title + "\" added to development pool.", "good");
      }

      const saveFn = (typeof saveGame === "function") ? saveGame : ((typeof global !== "undefined" && typeof global.saveGame === "function") ? global.saveGame : null);
      if(saveFn) saveFn();
      return true;
    }
  };

  global.BOW_SANDBOX = BOW_SANDBOX;

  // Custom Sandbox & Database Creator Modal (Box Office Sim 2 parity)
  global.openCustomSandboxModal = function(){
    const g = BOW_SANDBOX._getG();
    if(!g) return;

    let activeTab = "talent";

    function renderInnerContent(){
      let h = "<h3>Custom Sandbox &amp; Database Editor</h3>";
      h += "<p class='tiny muted' style='margin-bottom:12px'>Create custom actors, directors, rival studios, franchises, and screenplays to personalize your industry simulation (Box Office Sim 2 parity).</p>";

      // Sub-tabs
      h += "<div style='display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;touch-action:pan-x;'>";
      h += "<button class='btn btn-xs " + (activeTab === "talent" ? "btn-primary" : "btn-alt") + "' data-stab='talent'>Create Talent</button>";
      h += "<button class='btn btn-xs " + (activeTab === "rival" ? "btn-primary" : "btn-alt") + "' data-stab='rival'>Create Rival Studio</button>";
      h += "<button class='btn btn-xs " + (activeTab === "franchise" ? "btn-primary" : "btn-alt") + "' data-stab='franchise'>Create Franchise</button>";
      h += "<button class='btn btn-xs " + (activeTab === "idea" ? "btn-primary" : "btn-alt") + "' data-stab='idea'>Create Script</button>";
      h += "</div>";

      if(activeTab === "talent"){
        h += "<div class='card'>";
        h += "<b>Create Custom Actor or Director</b>";
        h += "<div class='grid g2' style='gap:8px;margin-top:8px'>";
        h += "<div><label class='tiny muted'>Full Name</label><input type='text' id='cs_name' class='input' placeholder='e.g. Leo Sterling' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Role</label><select id='cs_kind' class='input' style='width:100%'><option value='actor'>Actor / Star</option><option value='director'>Director</option></select></div>";
        h += "<div><label class='tiny muted'>Star Power Rating (1 to 5 Stars)</label><select id='cs_power' class='input' style='width:100%'><option value='5'>5 Stars (Marquee Superstar)</option><option value='4' selected>4 Stars (A-List Lead)</option><option value='3'>3 Stars (Working Star)</option><option value='2'>2 Stars (Rising Talent)</option></select></div>";
        h += "<div><label class='tiny muted'>Genre Specialty</label><select id='cs_genre' class='input' style='width:100%'><option value='action'>Action</option><option value='scifi'>Sci-Fi</option><option value='drama'>Drama</option><option value='comedy'>Comedy</option><option value='horror'>Horror</option><option value='romance'>Romance</option><option value='animation'>Animation</option></select></div>";
        h += "<div><label class='tiny muted'>Craft Skill (40 - 99)</label><input type='number' id='cs_skill' class='input' value='80' min='40' max='99' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Personal Trait / Quirk</label><select id='cs_quirk' class='input' style='width:100%'>";
        BOW_SANDBOX.QUIRKS.forEach(q => {
          h += "<option value='" + q.id + "'>" + q.name + " (" + q.desc + ")</option>";
        });
        h += "</select></div>";
        h += "</div>";
        h += "<button class='btn btn-sm btn-primary' id='btnSaveTalent' style='margin-top:12px;width:100%'>Inject Custom Talent into Game</button>";
        h += "</div>";
      } else if(activeTab === "rival"){
        h += "<div class='card'>";
        h += "<b>Create Custom Rival Studio</b>";
        h += "<div class='grid g2' style='gap:8px;margin-top:8px'>";
        h += "<div><label class='tiny muted'>Studio Name</label><input type='text' id='cr_name' class='input' placeholder='e.g. Mirage Pictures' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Studio Slate Style</label><select id='cr_style' class='input' style='width:100%'><option value='tentpole'>Tentpole Blockbuster Factory</option><option value='prestige'>Prestige Awards Darling</option><option value='balanced'>Balanced Commercial Slate</option><option value='horror'>Horror / Low-Budget High-ROI</option></select></div>";
        h += "<div><label class='tiny muted'>Starting War Chest ($M)</label><input type='number' id='cr_cash' class='input' value='350' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Studio Color</label><input type='color' id='cr_color' value='#e50914' style='width:100%;height:32px;padding:0'></div>";
        h += "</div>";
        h += "<button class='btn btn-sm btn-primary' id='btnSaveRival' style='margin-top:12px;width:100%'>Register Custom Rival Studio</button>";
        h += "</div>";
      } else if(activeTab === "franchise"){
        h += "<div class='card'>";
        h += "<b>Create Custom Legacy Franchise / IP</b>";
        h += "<div class='grid g2' style='gap:8px;margin-top:8px'>";
        h += "<div><label class='tiny muted'>Franchise Universe Name</label><input type='text' id='cfr_name' class='input' placeholder='e.g. Chrono Knight Universe' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Core Genre</label><select id='cfr_genre' class='input' style='width:100%'><option value='action'>Action</option><option value='scifi'>Sci-Fi</option><option value='fantasy'>Fantasy</option><option value='horror'>Horror</option><option value='animation'>Animation</option></select></div>";
        h += "<div style='grid-column:span 2'><label class='tiny muted'>Lore & Premise</label><input type='text' id='cfr_lore' class='input' placeholder='Epic multi-generational sci-fi saga' style='width:100%'></div>";
        h += "</div>";
        h += "<button class='btn btn-sm btn-primary' id='btnSaveFranchise' style='margin-top:12px;width:100%'>Add Custom Franchise to Vault</button>";
        h += "</div>";
      } else if(activeTab === "idea"){
        h += "<div class='card'>";
        h += "<b>Commission Custom Screenplay</b>";
        h += "<div class='grid g2' style='gap:8px;margin-top:8px'>";
        h += "<div><label class='tiny muted'>Script Title</label><input type='text' id='cid_title' class='input' placeholder='e.g. Quantum Midnight' style='width:100%'></div>";
        h += "<div><label class='tiny muted'>Genre</label><select id='cid_genre' class='input' style='width:100%'><option value='scifi'>Sci-Fi</option><option value='action'>Action</option><option value='thriller'>Thriller</option><option value='horror'>Horror</option><option value='drama'>Drama</option><option value='comedy'>Comedy</option></select></div>";
        h += "<div><label class='tiny muted'>Production Scale</label><select id='cid_scale' class='input' style='width:100%'><option value='tentpole'>Tentpole ($150M+)</option><option value='mid' selected>Mid-Budget ($40M-$80M)</option><option value='indie'>Indie ($10M-$25M)</option></select></div>";
        h += "<div><label class='tiny muted'>Starting Buzz Rating (50 - 95)</label><input type='number' id='cid_buzz' class='input' value='75' min='50' max='95' style='width:100%'></div>";
        h += "</div>";
        h += "<button class='btn btn-sm btn-primary' id='btnSaveIdea' style='margin-top:12px;width:100%'>Add Custom Script to Development Pool</button>";
        h += "</div>";
      }

      return h;
    }

    function wireEvents(modalEl){
      const inner = modalEl.querySelector("#sandboxModalInner");
      if(!inner) return;

      inner.querySelectorAll("[data-stab]").forEach(b => {
        b.onclick = function(e){
          e.stopPropagation();
          activeTab = b.dataset.stab;
          inner.innerHTML = renderInnerContent();
          wireEvents(modalEl);
        };
      });

      const bTalent = inner.querySelector("#btnSaveTalent");
      if(bTalent){
        bTalent.onclick = function(){
          const name = (inner.querySelector("#cs_name").value || "").trim();
          if(!name){ alert("Please enter talent name."); return; }
          const kind = inner.querySelector("#cs_kind").value;
          const power = inner.querySelector("#cs_power").value;
          const favGenre = inner.querySelector("#cs_genre").value;
          const skill = inner.querySelector("#cs_skill").value;
          const quirk = inner.querySelector("#cs_quirk").value;
          if(BOW_SANDBOX.createCustomTalent({ name, kind, power, favGenre, skill, quirk })){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            inner.innerHTML = renderInnerContent();
            wireEvents(modalEl);
          }
        };
      }

      const bRival = inner.querySelector("#btnSaveRival");
      if(bRival){
        bRival.onclick = function(){
          const name = (inner.querySelector("#cr_name").value || "").trim();
          if(!name){ alert("Please enter rival name."); return; }
          const style = inner.querySelector("#cr_style").value;
          const cash = inner.querySelector("#cr_cash").value;
          const color = inner.querySelector("#cr_color").value;
          if(BOW_SANDBOX.createCustomRival({ name, style, cash, color })){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            inner.innerHTML = renderInnerContent();
            wireEvents(modalEl);
          }
        };
      }

      const bFr = inner.querySelector("#btnSaveFranchise");
      if(bFr){
        bFr.onclick = function(){
          const name = (inner.querySelector("#cfr_name").value || "").trim();
          if(!name){ alert("Please enter franchise name."); return; }
          const genre = inner.querySelector("#cfr_genre").value;
          const lore = (inner.querySelector("#cfr_lore").value || "").trim();
          if(BOW_SANDBOX.createCustomFranchise({ name, genre, lore })){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            inner.innerHTML = renderInnerContent();
            wireEvents(modalEl);
          }
        };
      }

      const bIdea = inner.querySelector("#btnSaveIdea");
      if(bIdea){
        bIdea.onclick = function(){
          const title = (inner.querySelector("#cid_title").value || "").trim();
          if(!title){ alert("Please enter script title."); return; }
          const genre = inner.querySelector("#cid_genre").value;
          const scale = inner.querySelector("#cid_scale").value;
          const buzz = inner.querySelector("#cid_buzz").value;
          if(BOW_SANDBOX.createCustomIdea({ title, genre, scale, buzz })){
            if(typeof global.beep === "function") global.beep("gold");
            if(typeof global.render === "function") global.render();
            inner.innerHTML = renderInnerContent();
            wireEvents(modalEl);
          }
        };
      }
    }

    const initialHtml = "<div id='sandboxModalInner'>" + renderInnerContent() + "</div>";
    const v = (typeof global.openModal === "function") ? global.openModal(initialHtml) : null;
    if(v){
      wireEvents(v);
    }
  };

  // Dedicated Holiday Release Calendar Modal (Box Office Sim 2 parity)
  global.openHolidayCalendarModal = function(){
    const g = BOW_SANDBOX._getG();
    if(!g) return;
    const currentWoy = (typeof woyOf === "function") ? woyOf(g.week) : (((g.week - 1) % 52) + 1);

    let h = "<h3>Holiday Release Calendar &amp; Seasonality Corridors</h3>";
    h += "<p class='tiny muted'>Slot your major tentpoles and counterprogramming into high-traffic national holiday corridors to capture massive box office multipliers (Box Office Sim 2 parity).</p>";

    h += "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='row' style='justify-content:space-between;align-items:center'>";
    h += "<div><b>Current Industry Calendar:</b> <span class='gold'>Week " + currentWoy + " of 52</span></div>";
    h += "<div><span class='tag blue'>52-Week Annual Cycle</span></div>";
    h += "</div></div>";

    h += "<div class='grid g2' style='gap:10px'>";
    BOW_SANDBOX.HOLIDAY_CORRIDORS.forEach(corridor => {
      const isPast = corridor.week < currentWoy;
      const isCurrent = corridor.week === currentWoy;
      const isUpcoming = corridor.week > currentWoy;

      // Find player films scheduled in this week
      const myFilms = (g.projects || []).filter(p => {
        if(!p.releaseWeek) return false;
        const pw = (typeof woyOf === "function") ? woyOf(p.releaseWeek) : (((p.releaseWeek - 1) % 52) + 1);
        return pw === corridor.week;
      });

      h += "<div class='card " + (isCurrent ? "card-sub' style='border:2px solid var(--gold2)" : "'") + ">";
      h += "<div class='row' style='justify-content:space-between;align-items:center'>";
      h += "<b>Week " + corridor.week + ": " + corridor.name + "</b>";
      h += "<span class='tag " + (isCurrent ? "gold" : (isUpcoming ? "green" : "muted")) + "'>" + (isCurrent ? "Active Corridor" : (isUpcoming ? "Upcoming" : "Past")) + "</span>";
      h += "</div>";
      h += "<div class='row' style='gap:6px;margin:6px 0'>";
      h += "<span class='tag purple'>" + corridor.badge + "</span>";
      h += "<span class='tag gold'>Box Office ×" + corridor.mult.toFixed(2) + "</span>";
      h += "</div>";
      h += "<div class='tiny muted'>" + corridor.desc + "</div>";

      if(myFilms.length){
        h += "<div style='margin-top:8px;padding-top:6px;border-top:1px dashed rgba(255,255,255,0.1)'>";
        h += "<b class='tiny pos'>Your Slated Releases:</b>";
        myFilms.forEach(f => {
          h += "<div class='tiny gold'>• \"" + f.title + "\" (" + f.genre + " · " + (f.scale || "Standard") + ")</div>";
        });
        h += "</div>";
      } else {
        h += "<div class='tiny muted' style='margin-top:6px;font-style:italic'>No studio releases currently scheduled for this window.</div>";
      }
      h += "</div>";
    });
    h += "</div>";

    if(typeof global.openModal === "function"){
      global.openModal(h);
    }
  };

})(typeof window !== "undefined" ? window : global);
