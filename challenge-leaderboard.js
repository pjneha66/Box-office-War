/* ═════════════════════════════════════════════════════════════════════════
   CHALLENGE-LEADERBOARD.JS — Seeded Challenge Runs & Async Leaderboards
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_CHALLENGE = {
    version: "1.0.0",

    // Mulberry32 deterministic 32-bit PRNG
    prng(seedInt){
      let s = (seedInt >>> 0) || 123456789;
      return function(){
        let t = (s += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    hashSeed(str){
      let h = 2166136261 >>> 0;
      for(let i=0; i<str.length; i++){
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    getDailySeed(){
      const d = new Date();
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return "CHLG-" + y + m + day;
    },

    getWeeklySeed(){
      const d = new Date();
      const onejan = new Date(d.getUTCFullYear(), 0, 1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
      return "WEEKLY-" + d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
    },

    getDailyChallenge(){
      const seedStr = this.getDailySeed();
      const h = this.hashSeed(seedStr);
      const rnd = this.prng(h);
      const archetypes = ["producer", "indie", "conglomerate", "streamer", "auteur"];
      const modifiers = [
        { id: "golden_age", name: "Golden Age Revival", desc: "Drama and Musical gross +25%; marketing costs +15%." },
        { id: "streaming_squeeze", name: "Streaming Squeeze", desc: "Theatrical splits 5% lower; OTT auctions pay +30%." },
        { id: "tight_credit", name: "Credit Crunch", desc: "Interest rates +40%; max debt capacity capped at $200M." },
        { id: "franchise_fever", name: "Franchise Fever", desc: "Sequels open +20% higher; standalone films suffer -10%." },
        { id: "critics_reign", name: "Critics Reign", desc: "Critical scores weigh 2x on word-of-mouth box office legs." }
      ];
      const arch = archetypes[Math.floor(rnd() * archetypes.length)];
      const mod = modifiers[Math.floor(rnd() * modifiers.length)];
      return {
        id: seedStr,
        name: "Daily Challenge: " + seedStr,
        seed: h,
        seedStr,
        archetype: arch,
        modifier: mod,
        targetWeeks: 104,
        targetGross: 1000
      };
    },

    getWeeklyChallenge(){
      const seedStr = this.getWeeklySeed();
      const h = this.hashSeed(seedStr);
      const rnd = this.prng(h);
      const scenarios = [
        { id: "survival_indie", name: "Indie Survival Gauntlet", archetype: "indie", desc: "Start with $40M cash. Produce 8 profitable films in 156 weeks without defaulting." },
        { id: "tentpole_tycoon", name: "Tentpole Empire", archetype: "conglomerate", desc: "Generate $2.5B global box office with at least 3 tentpoles and 1 mega-franchise." },
        { id: "prestige_chase", name: "Prestige Master", archetype: "auteur", desc: "Win at least 5 major industry awards while maintaining positive solvency." }
      ];
      const scn = scenarios[Math.floor(rnd() * scenarios.length)];
      return {
        id: seedStr,
        name: scn.name,
        seed: h,
        seedStr,
        archetype: scn.archetype,
        desc: scn.desc,
        targetWeeks: 156
      };
    },

    calcScore(state){
      if(!state) return 0;
      const st = state.studio || {};
      const cash = Math.max(0, st.cash || 0);
      const val = Math.max(0, (typeof global.studioValuation === "function" ? global.studioValuation() : (cash * 1.5)));
      const films = state.films || [];
      const ww = films.reduce((acc, f) => acc + (f.ww || 0), 0);
      const hits = films.filter(f => (f.ww || 0) >= (f.budget || 20) * 2.2).length;
      const awards = (state.awardsWon || []).length;
      const debt = (st.debt || 0) + (st.mezzDebt || 0) + (state.investorDebt || 0);
      const rep = st.rep || 10;
      const weeks = state.week || 1;

      let score = Math.round(
        (cash * 1.2) +
        (val * 0.4) +
        (ww * 0.8) +
        (hits * 75) +
        (awards * 150) +
        (rep * 15) -
        (debt * 1.4) +
        (weeks * 2)
      );
      return Math.max(0, score);
    },

    generateShareCode(state){
      const score = this.calcScore(state);
      const payload = {
        v: 1,
        seed: state.challengeSeed || state.seed || "FREE",
        sc: score,
        w: state.week || 1,
        st: (state.studio && state.studio.name) || "Studio",
        f: (state.films || []).length,
        h: (state.films || []).filter(f => (f.ww || 0) >= (f.budget || 20) * 2.2).length,
        ww: Math.round((state.films || []).reduce((a, b) => a + (b.ww || 0), 0))
      };
      const json = JSON.stringify(payload);
      // Compact URL-safe Base64 encoding
      let b64 = "";
      try {
        b64 = btoa(unescape(encodeURIComponent(json)));
      } catch(e) {
        b64 = Buffer.from(json).toString("base64");
      }
      const check = (this.hashSeed(b64) % 9999).toString().padStart(4, "0");
      return "BOW-" + b64 + "-" + check;
    },

    verifyShareCode(code){
      if(!code || typeof code !== "string" || !code.startsWith("BOW-")) return null;
      const parts = code.slice(4).split("-");
      if(parts.length < 2) return null;
      const b64 = parts[0];
      const check = parts[1];
      if((this.hashSeed(b64) % 9999).toString().padStart(4, "0") !== check) return null;
      try {
        let json = "";
        try {
          json = decodeURIComponent(escape(atob(b64)));
        } catch(e) {
          json = Buffer.from(b64, "base64").toString("utf8");
        }
        return JSON.parse(json);
      } catch(e) {
        return null;
      }
    },

    saveLeaderboardEntry(entry){
      if(!global.G) return;
      global.G.leaderboard = global.G.leaderboard || [];
      const exists = global.G.leaderboard.some(e => e.seed === entry.seed && e.sc === entry.sc && e.st === entry.st);
      if(!exists){
        global.G.leaderboard.push(entry);
        global.G.leaderboard.sort((a,b) => (b.sc || 0) - (a.sc || 0));
        if(global.G.leaderboard.length > 50) global.G.leaderboard.length = 50;
        if(typeof global.saveGame === "function") global.saveGame();
      }
    }
  };

  // Attach to global scope
  global.BOW_CHALLENGE = BOW_CHALLENGE;

  // Global helper for opening challenge modal
  global.openChallengeModal = function(){
    if(!global.G) return;
    const daily = BOW_CHALLENGE.getDailyChallenge();
    const weekly = BOW_CHALLENGE.getWeeklyChallenge();
    const curScore = BOW_CHALLENGE.calcScore(global.G);
    const code = BOW_CHALLENGE.generateShareCode(global.G);
    const board = (global.G.leaderboard || []).slice(0, 10);

    let h = "<h3>🏆 Seeded Challenges & Async Leaderboards</h3>";
    h += "<p class='tiny muted'>Compete in deterministic seed runs with identical trends, talent rosters, and market events.</p>";

    h += "<div class='grid g2' style='margin-bottom:12px'>";
    h += "<div class='card' style='border-left:3px solid var(--gold2)'>";
    h += "<b>📅 Today's Daily Run</b>";
    h += "<div class='tiny muted'>Seed: <code>" + daily.seedStr + "</code></div>";
    h += "<div class='cost-line'><span>Archetype</span><b>" + daily.archetype.toUpperCase() + "</b></div>";
    h += "<div class='cost-line'><span>Condition</span><b>" + daily.modifier.name + "</b></div>";
    h += "<div class='tiny muted' style='margin-top:6px'>" + daily.modifier.desc + "</div>";
    h += "<button class='btn btn-sm btn-primary' id='btnStartDaily' style='margin-top:8px;width:100%'>Launch Daily Run</button>";
    h += "</div>";

    h += "<div class='card' style='border-left:3px solid var(--blue)'>";
    h += "<b>🗓 Weekly Marathon</b>";
    h += "<div class='tiny muted'>Seed: <code>" + weekly.seedStr + "</code></div>";
    h += "<div class='cost-line'><span>Mission</span><b>" + weekly.name + "</b></div>";
    h += "<div class='tiny muted' style='margin-top:6px'>" + weekly.desc + "</div>";
    h += "<button class='btn btn-sm btn-alt' id='btnStartWeekly' style='margin-top:8px;width:100%'>Launch Weekly Run</button>";
    h += "</div>";
    h += "</div>";

    h += "<div class='card' style='margin-bottom:12px'>";
    h += "<div class='spread'><b>Your Run Score: " + curScore.toLocaleString() + " pts</b><button class='btn btn-xs' id='btnCopyRunCode'>📋 Copy Share Code</button></div>";
    h += "<input id='txtRunCode' type='text' readonly value='" + code + "' style='width:100%;font-size:11px;font-family:monospace;background:#06080e;border:1px solid var(--line2);color:var(--text);padding:6px;border-radius:6px;margin-top:6px'>";
    h += "</div>";

    h += "<div class='card'>";
    h += "<div class='spread'><b class='small'>Hall of Fame / Leaderboard</b>";
    h += "<button class='btn btn-xs btn-alt' id='btnImportScore'>+ Import Competitor Code</button></div>";
    if(!board.length){
      h += "<div class='tiny muted' style='padding:8px 0'>No foreign entries logged yet. Share and import competitor codes!</div>";
    } else {
      h += "<div style='margin-top:8px;max-height:180px;overflow-y:auto'>";
      board.forEach((b, idx) => {
        h += "<div class='cost-line'><span>#" + (idx+1) + " <b>" + (b.st || "Studio") + "</b> (" + (b.seed || "FREE") + ")</span><b class='pos'>" + (b.sc || 0).toLocaleString() + " pts</b></div>";
      });
      h += "</div>";
    }
    h += "</div>";

    const v = (typeof global.openModal === "function") ? global.openModal(h) : null;
    if(!v) return;

    const bDaily = v.querySelector("#btnStartDaily");
    if(bDaily) bDaily.onclick = function(){
      if(confirm("Start a new game using the official daily seed (" + daily.seedStr + ")?")){
        if(typeof global.newGame === "function"){
          global.newGame(daily.archetype, "Daily " + daily.seedStr.slice(5));
          global.G.challenge = daily;
          global.G.challengeSeed = daily.seedStr;
          if(typeof global.closeModal === "function") global.closeModal();
          if(typeof global.render === "function") global.render();
          if(typeof global.toast === "function") global.toast("Started Daily Challenge: " + daily.seedStr, "gold");
        }
      }
    };

    const bWeekly = v.querySelector("#btnStartWeekly");
    if(bWeekly) bWeekly.onclick = function(){
      if(confirm("Start a new game with the weekly challenge (" + weekly.seedStr + ")?")){
        if(typeof global.newGame === "function"){
          global.newGame(weekly.archetype, "Weekly " + weekly.seedStr.slice(7));
          global.G.challenge = weekly;
          global.G.challengeSeed = weekly.seedStr;
          if(typeof global.closeModal === "function") global.closeModal();
          if(typeof global.render === "function") global.render();
          if(typeof global.toast === "function") global.toast("Started Weekly Challenge: " + weekly.name, "gold");
        }
      }
    };

    const bCopy = v.querySelector("#btnCopyRunCode");
    if(bCopy) bCopy.onclick = function(){
      const inp = v.querySelector("#txtRunCode");
      if(inp){
        inp.select();
        try { navigator.clipboard.writeText(inp.value); } catch(e){}
        if(typeof global.toast === "function") global.toast("Share code copied to clipboard", "good");
      }
    };

    const bImp = v.querySelector("#btnImportScore");
    if(bImp) bImp.onclick = function(){
      const userCode = prompt("Paste competitor share code (BOW-...):");
      if(userCode){
        const parsed = BOW_CHALLENGE.verifyShareCode(userCode.trim());
        if(parsed){
          BOW_CHALLENGE.saveLeaderboardEntry(parsed);
          if(typeof global.toast === "function") global.toast("Verified & logged run: " + parsed.st + " (" + parsed.sc + " pts)", "gold");
          global.openChallengeModal();
        } else {
          if(typeof global.toast === "function") global.toast("Invalid or corrupted share code signature.", "bad");
        }
      }
    };
  };

})(typeof window !== "undefined" ? window : global);
