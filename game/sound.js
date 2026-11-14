/* Box Office War — rebuilt. Tiny synth sound design: 3 cues, default silent.
   Toggle lives in Ledger → Settings. No assets, pure WebAudio. */
"use strict";

var SOUND_ON = false;
try { SOUND_ON = localStorage.getItem("bow2.sound") === "1"; } catch (e) {}

function setSound(on) {
  SOUND_ON = !!on;
  try { localStorage.setItem("bow2.sound", on ? "1" : "0"); } catch (e) {}
}

var __ac = null;
function sfx(kind) {
  if (!SOUND_ON) return;
  try {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    __ac = __ac || new Ctx();
    if (__ac.state === "suspended") __ac.resume();
    var t = __ac.currentTime;
    var seq = kind === "good" ? [[660, 0], [880, 0.09]]
            : kind === "gold" ? [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24]]
            : kind === "bad" ? [[220, 0], [160, 0.12]]
            : null;
    if (!seq) return;
    for (var i = 0; i < seq.length; i++) {
      var o = __ac.createOscillator(), g = __ac.createGain();
      o.type = "triangle";
      o.frequency.value = seq[i][0];
      o.connect(g); g.connect(__ac.destination);
      var st = t + seq[i][1];
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.07, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
      o.start(st); o.stop(st + 0.24);
    }
  } catch (e) { /* audio unavailable — stay silent */ }
}
