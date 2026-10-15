/* ═════════════════════════════════════════════════════════════════════════
   DYNAMIC-SOUNDTRACK.JS — Adaptive WebAudio Procedural Soundtrack
   Box Office War — Modular Engine Extension
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function(global){
  const BOW_SOUNDTRACK = {
    version: "1.0.0",
    ctx: null,
    masterGain: null,
    currentMood: "steady",
    isPlaying: false,
    timer: null,
    volume: 0.18,
    enabled: false,

    // Chord frequency presets (Hz)
    CHORDS: {
      steady:     [ [130.81, 164.81, 196.00], [146.83, 174.61, 220.00], [164.81, 196.00, 246.94] ], // C, Dm, Em
      tense:      [ [110.00, 130.81, 155.56], [123.47, 146.83, 174.61], [98.00, 116.54, 138.59] ],   // Am, Bdim, Gm
      triumphant: [ [130.81, 164.81, 196.00, 261.63], [174.61, 220.00, 261.63, 349.23], [196.00, 246.94, 293.66, 392.00] ], // C, F, G (major)
      somber:     [ [98.00, 116.54, 146.83], [82.41, 98.00, 123.47], [73.42, 87.31, 110.00] ]       // Gm, Em, Dm low
    },

    sfxEnabled: true,

    init(){
      if(typeof window === "undefined") return;
      try {
        const stored = localStorage.getItem("bow_music_enabled");
        if(stored === "true") this.enabled = true;
        const storedVol = localStorage.getItem("bow_music_vol");
        if(storedVol !== null) this.volume = parseFloat(storedVol) || 0.18;
        const storedSfx = localStorage.getItem("bow_sfx_enabled");
        if(storedSfx !== null) this.sfxEnabled = (storedSfx !== "false");
      } catch(e){}
    },

    ensureContext(){
      if(typeof window === "undefined") return false;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if(!AudioContext) return false;
      if(!this.ctx){
        try {
          this.ctx = new AudioContext();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        } catch(e){
          return false;
        }
      }
      if(this.ctx.state === "suspended"){
        this.ctx.resume().catch(function(){});
      }
      return true;
    },

    setVolume(vol){
      this.volume = Math.max(0, Math.min(1, vol));
      try { localStorage.setItem("bow_music_vol", this.volume); } catch(e){}
      if(this.masterGain && this.ctx){
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
    },

    setSFXEnabled(val){
      this.sfxEnabled = !!val;
      try { localStorage.setItem("bow_sfx_enabled", this.sfxEnabled ? "true" : "false"); } catch(e){}
    },

    playSFX(kind){
      if(!this.sfxEnabled) return;
      if(typeof global.beep === "function"){
        global.beep(kind);
      }
    },

    setMood(mood){
      if(!this.CHORDS[mood]) return;
      this.currentMood = mood;
    },

    evaluateMood(state){
      if(!state) return "steady";
      const st = state.studio || {};
      const cash = st.cash || 0;
      const debt = (st.debt || 0) + (st.mezzDebt || 0);
      const activeProd = (state.projects || []).filter(p => p.phase !== "ready").length;

      // Bankruptcy danger / extreme liquidity crisis
      if(cash < 15 && debt > 50) return "somber";
      // Production crunch or heavy debt burden
      if(activeProd >= 2 || debt > 150) return "tense";
      // Triumphant on recent hit or huge awards
      const recentHits = (state.films || []).slice(-3).some(f => (f.ww || 0) >= (f.budget || 20) * 3);
      if(recentHits || (state.awardsWon && state.awardsWon.length >= 3)) return "triumphant";

      return "steady";
    },

    playChordStep(){
      if(!this.isPlaying || !this.ctx || !this.enabled) return;
      const mood = this.currentMood;
      const chordList = this.CHORDS[mood] || this.CHORDS.steady;
      const chord = chordList[Math.floor(Math.random() * chordList.length)];
      const now = this.ctx.currentTime;
      const duration = (mood === "tense" ? 2.5 : mood === "somber" ? 4.5 : 3.8);

      chord.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = (mood === "tense" ? "sawtooth" : mood === "triumphant" ? "triangle" : "sine");
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(mood === "tense" ? 450 : mood === "somber" ? 280 : 600, now);

        const noteGain = 0.05 / chord.length;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(noteGain, now + 0.8 + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now + idx * 0.1);
        osc.stop(now + duration + 0.5);
      });

      this.timer = setTimeout(() => {
        if(this.isPlaying) this.playChordStep();
      }, (duration - 0.5) * 1000);
    },

    start(){
      if(this.isPlaying) return;
      if(!this.ensureContext()) return;
      this.isPlaying = true;
      this.playChordStep();
    },

    stop(){
      this.isPlaying = false;
      if(this.timer){
        clearTimeout(this.timer);
        this.timer = null;
      }
    },

    toggle(enable){
      this.enabled = (typeof enable === "boolean") ? enable : !this.enabled;
      try { localStorage.setItem("bow_music_enabled", this.enabled ? "true" : "false"); } catch(e){}
      if(this.enabled){
        this.start();
      } else {
        this.stop();
      }
      return this.enabled;
    },

    // Hook called on every game week tick
    tickWeekly(state){
      if(!state) return;
      const newMood = this.evaluateMood(state);
      this.setMood(newMood);
    },

    openAudioSettingsModal(){
      if(typeof global.openModal !== "function") return;
      let h = "<h3>Audio &amp; SoundFX Studio Suite</h3>";
      h += "<div class='tiny muted' style='margin-bottom:12px'>Procedural WebAudio soundscapes and retro tactile sound effects from itch.io free game audio packs.</div>";

      h += "<div class='card' style='margin-bottom:10px'>";
      h += "<div class='spread'><b>Adaptive Music Score</b><button class='btn btn-sm " + (this.enabled ? "btn-primary" : "btn-alt") + "' id='btnToggleMusic'>" + (this.enabled ? "Music: ON" : "Music: OFF") + "</button></div>";
      h += "<div class='tiny muted' style='margin-top:6px'>Current Mood: <b style='text-transform:uppercase;color:var(--gold)'>" + this.currentMood + "</b> (evaluates financial health, hit streaks, and awards)</div>";
      h += "<div style='margin-top:8px'><label class='tiny'>Music Master Volume: <span id='volDisplay'>" + Math.round(this.volume * 100) + "%</span></label>";
      h += "<input type='range' id='rngMusicVol' min='0' max='100' value='" + Math.round(this.volume * 100) + "' style='width:100%'></div>";
      h += "</div>";

      h += "<div class='card' style='margin-bottom:10px'>";
      h += "<div class='spread'><b>Tactile Sound FX (SFX)</b><button class='btn btn-sm " + (this.sfxEnabled ? "btn-primary" : "btn-alt") + "' id='btnToggleSFX'>" + (this.sfxEnabled ? "SFX: ON" : "SFX: OFF") + "</button></div>";
      h += "<div class='tiny muted' style='margin:6px 0 10px'>Crisp clicks, cash registers, 35mm projector hum, award fanfares, clapper snaps, and camera flashes.</div>";
      h += "<div class='row' style='flex-wrap:wrap;gap:6px'>";
      h += "<button class='btn btn-xs' data-testsfx='click'>Click</button>";
      h += "<button class='btn btn-xs' data-testsfx='cash'>Cash Register</button>";
      h += "<button class='btn btn-xs' data-testsfx='camera'>Camera Flash</button>";
      h += "<button class='btn btn-xs' data-testsfx='projector'>35mm Projector</button>";
      h += "<button class='btn btn-xs' data-testsfx='clap'>Clapper Slate</button>";
      h += "<button class='btn btn-xs' data-testsfx='fanfare'>Fanfare</button>";
      h += "<button class='btn btn-xs' data-testsfx='cheer'>Crowd Cheer</button>";
      h += "<button class='btn btn-xs' data-testsfx='disaster'>Disaster Rumble</button>";
      h += "</div>";
      h += "</div>";

      h += "<div class='modal-actions'><button class='btn btn-primary' onclick='closeModal()'>Done</button></div>";

      const v = global.openModal(h);
      if(!v) return;

      const btnMus = v.querySelector("#btnToggleMusic");
      if(btnMus){
        btnMus.onclick = () => {
          const on = this.toggle();
          btnMus.className = "btn btn-sm " + (on ? "btn-primary" : "btn-alt");
          btnMus.textContent = on ? "Music: ON" : "Music: OFF";
        };
      }

      const rng = v.querySelector("#rngMusicVol");
      const vDisp = v.querySelector("#volDisplay");
      if(rng){
        rng.oninput = (e) => {
          const val = parseInt(e.target.value, 10) / 100;
          this.setVolume(val);
          if(vDisp) vDisp.textContent = Math.round(val * 100) + "%";
        };
      }

      const btnSfx = v.querySelector("#btnToggleSFX");
      if(btnSfx){
        btnSfx.onclick = () => {
          this.setSFXEnabled(!this.sfxEnabled);
          btnSfx.className = "btn btn-sm " + (this.sfxEnabled ? "btn-primary" : "btn-alt");
          btnSfx.textContent = this.sfxEnabled ? "SFX: ON" : "SFX: OFF";
          if(this.sfxEnabled) this.playSFX("click");
        };
      }

      v.querySelectorAll("[data-testsfx]").forEach(b => {
        b.onclick = () => {
          this.playSFX(b.dataset.testsfx);
        };
      });
    }
  };

  // Initialize storage
  BOW_SOUNDTRACK.init();
  global.BOW_SOUNDTRACK = BOW_SOUNDTRACK;

  // Global helper for toggling soundtrack in UI
  global.toggleDynamicSoundtrack = function(){
    const on = BOW_SOUNDTRACK.toggle();
    if(typeof global.toast === "function"){
      global.toast(on ? "Adaptive Soundtrack: Enabled" : "Adaptive Soundtrack: Muted", on ? "gold" : "good");
    }
    return on;
  };

  global.openAudioSettingsModal = function(){
    BOW_SOUNDTRACK.openAudioSettingsModal();
  };

})(typeof window !== "undefined" ? window : global);
