/* ═════════════════════════════════════════════════════════════════════════
   LOT-LIFE.JS — Living World Layer for Box Office War
   ---------------------------------------------------------------------------
   PURE PRESENTATION. This file never reads or writes game state. It only
   observes G.week / G.season / the active room and paints atmosphere on an
   overlay canvas above the studio diorama:

     · 24-hour light cycle  (dawn → noon → golden hour → dusk → night)
     · weather per game week (clear / rain / storm / snow / falling leaves)
     · ambient life          (dust motes, birds, fireflies, camera flashes)
     · night light pools     (marquee bulbs, windows, street lamps, monitors)
     · cinematic finish      (volumetric shafts, vignette, film grain)
     · scene chrome          (location card, iris wipe on room change)

   The overlay is pointer-events:none and sits above the game canvas but
   below the control decks, so every existing interaction is untouched.
   ═════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (global) {
  if (global.LotLife) return;

  var doc = global.document;
  var REDUCED = false;
  try { REDUCED = global.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { REDUCED = false; }

  /* ───────────────────────── math helpers ───────────────────────── */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function hash32(n) {
    n = n | 0;
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return n >>> 0;
  }
  function rand01(seed) { return (hash32(seed) % 100000) / 100000; }
  function rgb(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }

  /* ───────────────────── 24-hour light keyframes ───────────────────── */
  /* rgb = the colour multiplied over the scene, a = strength,
     light = how "lit" the world is (drives lamps, fireflies, windows). */
  var PHASES = [
    { t: 0.00, rgb: [9, 16, 40], a: 0.66, light: 0.10, name: "MIDNIGHT" },
    { t: 0.07, rgb: [30, 32, 74], a: 0.56, light: 0.18, name: "SMALL HOURS" },
    { t: 0.14, rgb: [255, 138, 92], a: 0.30, light: 0.42, name: "SUNRISE" },
    { t: 0.22, rgb: [255, 214, 176], a: 0.13, light: 0.80, name: "MORNING" },
    { t: 0.38, rgb: [255, 255, 255], a: 0.02, light: 1.00, name: "MIDDAY" },
    { t: 0.55, rgb: [255, 228, 182], a: 0.09, light: 0.94, name: "AFTERNOON" },
    { t: 0.67, rgb: [255, 146, 62], a: 0.26, light: 0.78, name: "GOLDEN HOUR" },
    { t: 0.77, rgb: [104, 70, 138], a: 0.36, light: 0.44, name: "DUSK" },
    { t: 0.85, rgb: [16, 24, 62], a: 0.56, light: 0.18, name: "NIGHT" },
    { t: 1.00, rgb: [9, 16, 40], a: 0.66, light: 0.10, name: "MIDNIGHT" }
  ];

  function phaseAt(t) {
    t = t - Math.floor(t);
    for (var i = 0; i < PHASES.length - 1; i++) {
      var a = PHASES[i], b = PHASES[i + 1];
      if (t >= a.t && t <= b.t) {
        var k = smooth((t - a.t) / Math.max(0.0001, b.t - a.t));
        return {
          rgb: [lerp(a.rgb[0], b.rgb[0], k), lerp(a.rgb[1], b.rgb[1], k), lerp(a.rgb[2], b.rgb[2], k)],
          a: lerp(a.a, b.a, k),
          light: lerp(a.light, b.light, k),
          name: k < 0.5 ? a.name : b.name
        };
      }
    }
    return { rgb: PHASES[0].rgb, a: PHASES[0].a, light: PHASES[0].light, name: PHASES[0].name };
  }

  /* ─────────── warm light sources, normalised per room ─────────── */
  /* [x, y, radius, strength] — eyeballed against each diorama. */
  var LIGHT_MAP = {
    campus: [
      [0.155, 0.615, 0.115, 1.00], // cinema marquee bulbs
      [0.352, 0.610, 0.085, 0.85], // studio gate lamps
      [0.497, 0.300, 0.080, 0.80], // stage 1 door
      [0.668, 0.330, 0.075, 0.70], // stage 2 door
      [0.118, 0.420, 0.070, 0.60], // post building windows
      [0.268, 0.215, 0.075, 0.55], // executive tower
      [0.430, 0.490, 0.055, 0.55], // writers bungalow porch
      [0.760, 0.430, 0.050, 0.45]  // stage 4 lot lamp
    ],
    cinema: [
      [0.755, 0.250, 0.220, 1.00], // projection screen bounce
      [0.160, 0.430, 0.090, 0.85], // popcorn machine
      [0.090, 0.180, 0.075, 0.60], // wall sconce
      [0.930, 0.185, 0.075, 0.60]  // wall sconce
    ],
    executive: [
      [0.560, 0.110, 0.180, 0.95], // window skyline
      [0.405, 0.395, 0.060, 0.90], // banker lamp
      [0.215, 0.235, 0.070, 0.55], // awards cabinet glow
      [0.845, 0.330, 0.060, 0.45]  // side lamp
    ],
    writers: [
      [0.690, 0.120, 0.170, 1.00], // window light
      [0.145, 0.400, 0.070, 0.75], // coffee percolator
      [0.520, 0.400, 0.080, 0.55], // desk lamps
      [0.780, 0.430, 0.070, 0.55]
    ],
    soundstage: [
      [0.500, 0.180, 0.260, 1.00], // overhead rig
      [0.800, 0.400, 0.110, 0.70], // monitor village
      [0.220, 0.360, 0.090, 0.55]
    ],
    post: [
      [0.500, 0.380, 0.200, 1.00], // monitor wall
      [0.180, 0.300, 0.080, 0.55],
      [0.840, 0.320, 0.080, 0.55]
    ]
  };

  /* ─────────────────────────── state ─────────────────────────── */
  var S = {
    host: null,          // #studiolotContainer
    cv: null, ctx: null,
    w: 0, h: 0, dpr: 1,
    raf: 0,
    last: 0,
    t0: 0,
    clock: 0.34,         // 0..1 day phase, starts mid-morning
    light: 1,
    weather: "clear",
    weatherWeek: -1,
    season: "summer",
    view: "campus",
    motes: [], rain: [], snow: [], leaves: [], birds: [], flies: [], flashes: [],
    spawn: { bird: 0, flash: 0, bolt: 0 },
    bolt: 0,
    pointer: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 },
    grain: null, glow: null, shaft: null,
    card: null, wipe: null,
    lastLabel: ""
  };

  /* ─────────────────── cached sprites (built once) ─────────────────── */
  function makeCanvas(w, h) {
    try {
      var c = doc.createElement("canvas");
      c.width = w; c.height = h;
      var g = c.getContext("2d");
      if (!g || typeof g.createRadialGradient !== "function") return null;
      return { c: c, g: g };
    } catch (e) { return null; }
  }

  function buildGlowSprite() {
    var size = 256;
    var made = makeCanvas(size, size);
    if (!made) return null;
    var c = made.c, g = made.g;
    var rad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    rad.addColorStop(0, "rgba(255,236,190,0.95)");
    rad.addColorStop(0.35, "rgba(255,196,110,0.45)");
    rad.addColorStop(0.72, "rgba(255,150,60,0.12)");
    rad.addColorStop(1, "rgba(255,140,40,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function buildShaftSprite() {
    var w = 220, h = 900;
    var made = makeCanvas(w, h);
    if (!made) return null;
    var c = made.c, g = made.g;
    var lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, "rgba(255,246,214,0.30)");
    lg.addColorStop(0.45, "rgba(255,238,196,0.10)");
    lg.addColorStop(1, "rgba(255,230,180,0)");
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(w * 0.42, 0);
    g.lineTo(w * 0.58, 0);
    g.lineTo(w, h);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    return c;
  }

  function buildGrainSprite() {
    var size = 128;
    var made = makeCanvas(size, size);
    if (!made) return null;
    var c = made.c, g = made.g;
    if (typeof g.createImageData !== "function") return null;
    var img = g.createImageData(size, size);
    if (!img || !img.data) return null;
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = 110 + ((Math.random() * 90) | 0);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /* ─────────────────────── scene / season reads ─────────────────────── */
  function gameState() { return global.G || null; }
  function currentWeek() {
    var g = gameState();
    return (g && typeof g.week === "number" && g.week > 0) ? g.week : 1;
  }
  function currentSeason() {
    if (typeof global.seasonOfW === "function") {
      try {
        var s = global.seasonOfW(currentWeek());
        if (s) return String(s).toLowerCase();
      } catch (e) { /* fall through */ }
    }
    var idx = Math.floor(((currentWeek() - 1) % 52) / 13);
    return ["winter", "spring", "summer", "autumn"][idx] || "summer";
  }
  function currentView() {
    try {
      if (global.StudioLot2D && typeof global.StudioLot2D.getView === "function") return global.StudioLot2D.getView();
    } catch (e) { /* ignore */ }
    return S.view || "campus";
  }

  /* ──────────────────────── weather model ──────────────────────── */
  function weatherFor(week, season) {
    var h = hash32(week * 977 + 13) % 100;
    if (season === "winter") return h < 40 ? "snow" : (h < 50 ? "storm" : "clear");
    if (season === "autumn") return h < 26 ? "leaves" : (h < 40 ? "rain" : "clear");
    if (season === "spring") return h < 30 ? "rain" : (h < 38 ? "clear" : "clear");
    return h < 22 ? "rain" : (h < 30 ? "storm" : "clear");
  }

  /* ─────────────────────── particle seeding ─────────────────────── */
  function seedWeather(kind) {
    S.rain.length = 0; S.snow.length = 0; S.leaves.length = 0;
    var i;
    if (kind === "rain" || kind === "storm") {
      var n = kind === "storm" ? 190 : 130;
      for (i = 0; i < n; i++) {
        S.rain.push({
          x: Math.random(), y: Math.random(),
          v: 0.55 + Math.random() * 0.75,
          len: 10 + Math.random() * 16,
          a: 0.10 + Math.random() * 0.22
        });
      }
    } else if (kind === "snow") {
      for (i = 0; i < 110; i++) {
        S.snow.push({
          x: Math.random(), y: Math.random(),
          v: 0.012 + Math.random() * 0.035,
          r: 0.7 + Math.random() * 1.8,
          sw: Math.random() * Math.PI * 2,
          a: 0.35 + Math.random() * 0.5
        });
      }
    } else if (kind === "leaves") {
      for (i = 0; i < 46; i++) {
        S.leaves.push({
          x: Math.random(), y: Math.random(),
          v: 0.02 + Math.random() * 0.05,
          r: 2 + Math.random() * 3,
          sw: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI,
          hue: [28, 16, 42, 8][i % 4],
          a: 0.35 + Math.random() * 0.45
        });
      }
    }
  }

  function seedAmbient() {
    S.motes.length = 0;
    for (var i = 0; i < 46; i++) {
      S.motes.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.006,
        vy: -0.004 - Math.random() * 0.010,
        r: 0.5 + Math.random() * 1.6,
        ph: Math.random() * Math.PI * 2,
        a: 0.10 + Math.random() * 0.22
      });
    }
    S.flies.length = 0;
    for (var j = 0; j < 20; j++) {
      S.flies.push({
        x: Math.random(), y: 0.35 + Math.random() * 0.6,
        ph: Math.random() * Math.PI * 2,
        sp: 0.15 + Math.random() * 0.3,
        r: 0.9 + Math.random() * 1.5
      });
    }
  }

  /* ──────────────────────────── drawing ──────────────────────────── */

  function drawLightPools(ctx, nightness) {
    if (nightness < 0.04 || !S.glow) return;
    var spots = LIGHT_MAP[S.view] || LIGHT_MAP.campus;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < spots.length; i++) {
      var sp = spots[i];
      var r = sp[2] * Math.max(S.w, S.h) * (0.85 + 0.15 * Math.sin(S.clock * 40 + i));
      var a = sp[3] * nightness;
      ctx.globalAlpha = clamp(a, 0, 0.95);
      ctx.drawImage(S.glow, sp[0] * S.w - r, sp[1] * S.h - r, r * 2, r * 2);
    }
    ctx.restore();
  }

  function drawShafts(ctx, dayness) {
    if (dayness < 0.25 || REDUCED || !S.shaft) return;
    var a = dayness * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp(a * 0.82, 0, 0.42);
    for (var i = 0; i < 3; i++) {
      var drift = Math.sin(S.clock * 12 + i * 2.1) * 0.05;
      var x = (0.12 + i * 0.31 + drift) * S.w;
      ctx.save();
      ctx.translate(x, -S.h * 0.08);
      ctx.rotate(0.24 + i * 0.02);
      ctx.drawImage(S.shaft, -110, 0, 220, S.h * 1.5);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMotes(ctx, dt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < S.motes.length; i++) {
      var m = S.motes[i];
      m.x += m.vx * dt * 60;
      m.y += m.vy * dt * 60;
      if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
      if (m.x < -0.05) m.x = 1.05;
      if (m.x > 1.05) m.x = -0.05;
      var px = (m.x + (S.pointer.x - 0.5) * 0.012) * S.w;
      var py = (m.y + (S.pointer.y - 0.5) * 0.008) * S.h;
      var tw = 0.55 + 0.45 * Math.sin(S.clock * 90 + m.ph);
      ctx.globalAlpha = m.a * tw;
      ctx.fillStyle = "#ffe9b8";
      ctx.beginPath();
      ctx.arc(px, py, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRain(ctx, dt, storm) {
    ctx.save();
    ctx.strokeStyle = "rgba(196,224,255,0.55)";
    ctx.lineWidth = 1;
    for (var i = 0; i < S.rain.length; i++) {
      var d = S.rain[i];
      d.y += d.v * dt * 1.35;
      d.x -= d.v * dt * 0.16;
      if (d.y > 1.06) { d.y = -0.06; d.x = Math.random(); }
      if (d.x < -0.05) d.x = 1.05;
      var px = d.x * S.w, py = d.y * S.h;
      ctx.globalAlpha = d.a;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - d.len * 0.22, py + d.len);
      ctx.stroke();
    }
    ctx.restore();
    if (storm) {
      /* lightning strike envelope */
      S.spawn.bolt -= dt;
      if (S.spawn.bolt <= 0) {
        S.spawn.bolt = 7 + Math.random() * 9;
        S.bolt = 1;
      }
      if (S.bolt > 0) {
        var f = S.bolt > 0.72 ? (S.bolt - 0.72) / 0.28 : S.bolt / 0.72;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(214,232,255," + (0.30 * f).toFixed(3) + ")";
        ctx.fillRect(0, 0, S.w, S.h);
        ctx.restore();
        S.bolt -= dt * 2.6;
      }
    }
  }

  function drawSnow(ctx, dt) {
    ctx.save();
    for (var i = 0; i < S.snow.length; i++) {
      var s = S.snow[i];
      s.y += s.v * dt * 1.1;
      s.sw += dt * 0.9;
      if (s.y > 1.04) { s.y = -0.04; s.x = Math.random(); }
      var px = (s.x + Math.sin(s.sw) * 0.012) * S.w;
      var py = s.y * S.h;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#eaf4ff";
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLeaves(ctx, dt) {
    ctx.save();
    for (var i = 0; i < S.leaves.length; i++) {
      var l = S.leaves[i];
      l.y += l.v * dt * 1.1;
      l.sw += dt * 1.4;
      l.rot += dt * 1.6;
      if (l.y > 1.05) { l.y = -0.05; l.x = Math.random(); }
      var px = (l.x + Math.sin(l.sw) * 0.03) * S.w;
      var py = l.y * S.h;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(l.rot);
      ctx.globalAlpha = l.a;
      ctx.fillStyle = "hsl(" + l.hue + ",72%,52%)";
      ctx.fillRect(-l.r, -l.r * 0.55, l.r * 2, l.r * 1.1);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBirds(ctx, dt, dayness) {
    if (dayness < 0.45 || REDUCED) return;
    S.spawn.bird -= dt;
    if (S.spawn.bird <= 0 && S.birds.length < 5) {
      S.spawn.bird = 5 + Math.random() * 9;
      S.birds.push({
        x: -0.08, y: 0.06 + Math.random() * 0.22,
        v: 0.045 + Math.random() * 0.045,
        ph: Math.random() * Math.PI * 2,
        s: 2.4 + Math.random() * 2.2
      });
    }
    ctx.save();
    ctx.strokeStyle = "rgba(28,34,52,0.55)";
    ctx.lineWidth = 1.4;
    for (var i = S.birds.length - 1; i >= 0; i--) {
      var b = S.birds[i];
      b.x += b.v * dt;
      b.ph += dt * 9;
      if (b.x > 1.1) { S.birds.splice(i, 1); continue; }
      var px = b.x * S.w, py = b.y * S.h;
      var flap = Math.sin(b.ph) * b.s * 0.55;
      ctx.beginPath();
      ctx.moveTo(px - b.s, py + flap);
      ctx.quadraticCurveTo(px - b.s * 0.4, py - b.s * 0.4, px, py);
      ctx.quadraticCurveTo(px + b.s * 0.4, py - b.s * 0.4, px + b.s, py + flap);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFireflies(ctx, dt, nightness) {
    if (nightness < 0.35 || REDUCED || !S.glow) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < S.flies.length; i++) {
      var f = S.flies[i];
      f.ph += dt * f.sp;
      var px = (f.x + Math.sin(f.ph * 0.7) * 0.035) * S.w;
      var py = (f.y + Math.cos(f.ph * 0.55) * 0.025) * S.h;
      var a = (0.35 + 0.65 * Math.max(0, Math.sin(f.ph * 1.7))) * nightness;
      ctx.globalAlpha = a;
      ctx.drawImage(S.glow, px - 16, py - 16, 32, 32);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = "#fff6cf";
      ctx.beginPath();
      ctx.arc(px, py, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFlashes(ctx, dt, nightness) {
    S.spawn.flash -= dt;
    if (S.spawn.flash <= 0) {
      S.spawn.flash = 2.5 + Math.random() * 5;
      S.flashes.push({
        x: 0.08 + Math.random() * 0.84,
        y: 0.55 + Math.random() * 0.4,
        life: 1
      });
    }
    if (!S.flashes.length) return;
    if (!S.glow) { S.flashes.length = 0; return; }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = S.flashes.length - 1; i >= 0; i--) {
      var fl = S.flashes[i];
      fl.life -= dt * 2.4;
      if (fl.life <= 0) { S.flashes.splice(i, 1); continue; }
      var a = fl.life * (0.55 + nightness * 0.45);
      var px = fl.x * S.w, py = fl.y * S.h;
      var r = (1 - fl.life) * 60 + 12;
      ctx.globalAlpha = a;
      ctx.drawImage(S.glow, px - r, py - r, r * 2, r * 2);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px - r * 0.9, py); ctx.lineTo(px + r * 0.9, py);
      ctx.moveTo(px, py - r * 0.9); ctx.lineTo(px, py + r * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVignette(ctx) {
    if (!S._vig || S._vigW !== S.w || S._vigH !== S.h) {
      var g = ctx.createRadialGradient(S.w * 0.5, S.h * 0.48, Math.min(S.w, S.h) * 0.28,
        S.w * 0.5, S.h * 0.5, Math.max(S.w, S.h) * 0.78);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.62, "rgba(0,0,0,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0.52)");
      S._vig = g; S._vigW = S.w; S._vigH = S.h;
    }
    ctx.save();
    ctx.fillStyle = S._vig;
    ctx.fillRect(0, 0, S.w, S.h);
    ctx.restore();
  }

  function drawGrain(ctx) {
    if (!S.grain) return;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.055;
    var ox = (Math.random() * 128) | 0, oy = (Math.random() * 128) | 0;
    var pat = ctx.createPattern(S.grain, "repeat");
    if (pat) {
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, S.w + 128, S.h + 128);
    }
    ctx.restore();
  }

  /* ───────────────────────── main loop ───────────────────────── */
  function frame(ts) {
    S.raf = global.requestAnimationFrame(frame);
    if (!S.ctx || !S.cv) return;
    if (doc.hidden) return;

    var dt = S.last ? Math.min(0.05, (ts - S.last) / 1000) : 0.016;
    S.last = ts;

    /* day clock: one full cycle every 220 s, nudged per room so each
       room has its own mood instead of all changing in lockstep */
    if (!REDUCED) S.clock += dt / 220;
    if (S.clock > 1) S.clock -= 1;

    var ph = phaseAt(S.clock);
    var nightness = clamp(1 - ph.light, 0, 1);
    var dayness = clamp(ph.light, 0, 1);

    S.pointer.x = lerp(S.pointer.x, S.pointer.tx, 0.06);
    S.pointer.y = lerp(S.pointer.y, S.pointer.ty, 0.06);

    var ctx = S.ctx;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);

    /* 1 — light pools read as "the studio is working late" */
    drawLightPools(ctx, nightness);

    /* 2 — colour grade */
    if (ph.a > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = rgb(ph.rgb, ph.a);
      ctx.fillRect(0, 0, S.w, S.h);
      ctx.restore();
    }

    /* 3 — volumetric shafts during daylight */
    drawShafts(ctx, dayness);

    /* 4 — weather */
    if (S.weather === "rain") drawRain(ctx, dt, false);
    else if (S.weather === "storm") drawRain(ctx, dt, true);
    else if (S.weather === "snow") drawSnow(ctx, dt);
    else if (S.weather === "leaves") drawLeaves(ctx, dt);

    /* 5 — ambient life */
    drawMotes(ctx, dt);
    drawBirds(ctx, dt, dayness);
    drawFireflies(ctx, dt, nightness);
    drawFlashes(ctx, dt, nightness);

    /* 6 — cinematic finish */
    drawVignette(ctx);
    drawGrain(ctx);

    /* 7 — publish mood to CSS so chrome can breathe with the scene */
    var mood = ph.name;
    if (mood !== S.lastLabel) {
      S.lastLabel = mood;
      try {
        doc.documentElement.style.setProperty("--life-light", ph.light.toFixed(3));
        /* the whole app breathes with the scene: soft wash behind the panels */
        doc.documentElement.style.setProperty("--life-tint", rgb(ph.rgb, (0.16 * ph.a + 0.02).toFixed(3)));
        doc.documentElement.setAttribute("data-dayphase", mood.toLowerCase().replace(/\s+/g, "-"));
      } catch (e) { /* ignore */ }
      updateCard();
    }
  }

  /* ─────────────────────────── scene card ─────────────────────────── */
  var ROOM_META = {
    campus: { name: "STUDIO LOT", sub: "Hollywood Production Campus", icon: "assets/2d/studio_gate.png" },
    soundstage: { name: "SOUNDSTAGE 1", sub: "Principal Photography", icon: "assets/2d/soundstage.png" },
    writers: { name: "WRITERS BUNGALOW", sub: "Screenplay Lab", icon: "assets/2d/writers_bungalow.png" },
    post: { name: "POST & VFX", sub: "Edit · Sound · Color", icon: "assets/2d/post_suite.png" },
    cinema: { name: "PREMIERE PALACE", sub: "Box Office & Exhibition", icon: "assets/2d/cinema_theater.png" },
    executive: { name: "EXECUTIVE FLOOR", sub: "Central Command", icon: "assets/2d/executive.png" }
  };

  function updateCard() {
    if (!S.card) return;
    var v = currentView();
    var meta = ROOM_META[v] || ROOM_META.campus;
    var ph = phaseAt(S.clock);
    var w = currentWeek();
    var wk = "Y" + (Math.floor((w - 1) / 52) + 1) + " W" + (((w - 1) % 52) + 1);
    var weatherLabel = { clear: "CLEAR", rain: "RAIN", storm: "STORM", snow: "SNOW", leaves: "WIND" }[S.weather] || "CLEAR";
    var html = '' +
      '<span class="ll-card-icon" style="background-image:url(' + meta.icon + ')"></span>' +
      '<span class="ll-card-body">' +
        '<b class="ll-card-title">' + meta.name + '</b>' +
        '<i class="ll-card-sub">' + meta.sub + '</i>' +
      '</span>' +
      '<span class="ll-card-meta">' +
        '<em class="ll-chip">' + wk + '</em>' +
        '<em class="ll-chip ll-chip-day">' + ph.name + '</em>' +
        '<em class="ll-chip ll-chip-wx">' + weatherLabel + '</em>' +
      '</span>';
    if (S.card.innerHTML !== html) S.card.innerHTML = html;
    S.card.setAttribute("data-room", v);
  }

  /* ─────────────────────────── iris wipe ─────────────────────────── */
  function wipe() {
    if (!S.wipe || REDUCED) return;
    S.wipe.classList.remove("ll-wipe-run");
    void S.wipe.offsetWidth;
    S.wipe.classList.add("ll-wipe-run");
  }

  /* ─────────────────────────── attach / detach ─────────────────────────── */
  function build() {
    var host = doc.getElementById("studiolotContainer");
    var stage = doc.getElementById("studiolotGlobalStage");
    if (!host || !stage) return false;
    /* ui.js detects an already-mounted lot with "#studiolotContainer canvas".
       Never put our canvas inside the container — attach to the stage instead
       and wait until the real lot canvas exists. */
    if (!host.querySelector("#studioLotCanvas")) return false;
    if (S.unsupported) return true;

    if (S.host !== host || !S.cv || !doc.contains(S.cv)) {
      S.host = host;
      S.stage = stage;
      if (S.cv && S.cv.parentNode) S.cv.parentNode.removeChild(S.cv);

      var cv = doc.createElement("canvas");
      cv.className = "lot-life-canvas";
      cv.setAttribute("aria-hidden", "true");

      var ctx2d = null;
      try { ctx2d = cv.getContext("2d", { alpha: true }); } catch (e) { ctx2d = null; }
      if (!ctx2d) {
        /* headless / no-2d-context environments (jsdom): stand down quietly */
        S.unsupported = true;
        S.cv = null;
        S.ctx = null;
        return true;
      }

      stage.appendChild(cv);
      S.cv = cv;
      S.ctx = ctx2d;
      S.dpr = Math.min(2, global.devicePixelRatio || 1);

      if (!S.glow) S.glow = buildGlowSprite();
      if (!S.shaft) S.shaft = buildShaftSprite();
      if (!S.grain) S.grain = buildGrainSprite();
      if (!S.motes.length) seedAmbient();

      resize();
    }
    return true;
  }

  function resize() {
    if (!S.cv || !S.host) return;
    var r = (S.stage || S.host).getBoundingClientRect();
    S.w = Math.max(1, Math.round(r.width));
    S.h = Math.max(1, Math.round(r.height));
    S.cv.width = Math.round(S.w * S.dpr);
    S.cv.height = Math.round(S.h * S.dpr);
    S.cv.style.width = S.w + "px";
    S.cv.style.height = S.h + "px";
    syncChrome();
  }

  /* Publish the sticky header height so the cinematic banner can dock
     directly beneath it without guessing. */
  function syncChrome() {
    try {
      var tb = doc.querySelector(".topbar");
      if (!tb) return;
      var h = Math.round(tb.getBoundingClientRect().height);
      if (h > 0) doc.documentElement.style.setProperty("--bow-topbar-h", h + "px");
    } catch (e) { /* ignore */ }
  }

  function ensureCard() {
    var stage = doc.getElementById("studiolotGlobalStage");
    if (!stage) return;
    if (!S.card || !doc.contains(S.card)) {
      var c = doc.createElement("div");
      c.className = "lot-scene-card";
      c.setAttribute("aria-live", "polite");
      stage.appendChild(c);
      S.card = c;
    }
    if (!S.wipe || !doc.contains(S.wipe)) {
      var w = doc.createElement("div");
      w.className = "lot-wipe";
      w.setAttribute("aria-hidden", "true");
      stage.appendChild(w);
      S.wipe = w;
    }
    if (!S.fade || !doc.contains(S.fade)) {
      var f = doc.createElement("div");
      f.className = "lot-banner-fade";
      f.setAttribute("aria-hidden", "true");
      stage.appendChild(f);
      S.fade = f;
    }
  }

  function syncWorld() {
    var wk = currentWeek();
    var season = currentSeason();
    if (wk !== S.weatherWeek || season !== S.season) {
      S.weatherWeek = wk;
      S.season = season;
      var next = weatherFor(wk, season);
      if (next !== S.weather) {
        S.weather = next;
        seedWeather(next);
      }
    }
    S.view = currentView();
    if (S.view === "executive" || S.view === "writers") {
      /* interior rooms: keep weather outside, but soften it */
      if (S.weather === "storm" && S.bolt <= 0) S.spawn.bolt = 0.2;
    }
  }

  /* ─────────────────────────── public API ─────────────────────────── */
  var api = {
    start: function () {
      if (!build()) return false;
      ensureCard();
      syncWorld();
      updateCard();
      if (!S.raf) S.raf = global.requestAnimationFrame(frame);
      return true;
    },
    resize: resize,
    refresh: function () { syncChrome(); syncWorld(); updateCard(); },
    wipe: wipe,
    /* QA hook: force a time of day, e.g. LotLife.setClock(0.9) for night */
    setClock: function (v) {
      if (typeof v !== "number" || !isFinite(v)) return;
      S.clock = ((v % 1) + 1) % 1;
      updateCard();
    },
    mood: function () { return phaseAt(S.clock); },
    weather: function () { return S.weather; }
  };

  global.LotLife = api;
  if (!global.BOW_LEGACY_LOT_EFFECTS) return; // No default listeners, polling or overlay owner.

  /* ─────────────────────────── boot wiring ─────────────────────────── */
  var _bootTries = 0;
  function boot() {
    if (!global.BOW_LEGACY_LOT_EFFECTS) return; // Gameplay canvas owns presentation.
    /* The lot only exists after the player enters a save, so poll until the
       real canvas is mounted, then stop. */
    if (api.start()) {
      ensureCard();
      try {
        var mo = new MutationObserver(function () {
          if (!S.cv || !doc.contains(S.cv)) { if (build()) ensureCard(); }
        });
        var host = doc.getElementById("studiolotGlobalStage");
        if (host) mo.observe(host, { childList: true });
      } catch (e) { /* MutationObserver unavailable — resize hook still works */ }
      return;
    }
    if (++_bootTries > 240) return;   // ~84 s, then wait for an explicit retry
    setTimeout(boot, 350);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else setTimeout(boot, 60);

  global.addEventListener("resize", function () { api.resize(); });

  /* pointer parallax (never blocks the game's own handlers) */
  doc.addEventListener("mousemove", function (e) {
    if (!S.host) return;
    var r = S.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    S.pointer.tx = clamp((e.clientX - r.left) / r.width, 0, 1);
    S.pointer.ty = clamp((e.clientY - r.top) / r.height, 0, 1);
  }, { passive: true });

  /* tab switches: re-read room + weather, and iris-wipe the stage */
  doc.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(".tab, .btab, .kairo-nav-tab")) {
      setTimeout(function () { api.refresh(); wipe(); }, 30);
    }
  }, true);

  /* week advance: weather can change */
  var _weekWatch = setInterval(function () {
    if (!S.host) return;
    var wk = currentWeek();
    if (wk !== S.weatherWeek) { syncWorld(); updateCard(); }
  }, 1200);
  if (_weekWatch && _weekWatch.unref) _weekWatch.unref();

})(typeof window !== "undefined" ? window : global);
