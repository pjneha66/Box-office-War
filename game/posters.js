/* Box Office War — rebuilt. Posters module (wave 4). All state under S.posters.
   posterSVG(f) → a deterministic 300×450 SVG one-sheet for a film: seed = FNV-1a hash of
   film.id (+ per-film stored variant offset 0–3), vertical gradient from the genre palette,
   3–5 layered motif shapes, wrapped uppercase title, faint genre emoji, studio monogram,
   credit line and release year. PURE: it only reads S.posters/S.studio, never mutates —
   ui.js can embed the string anywhere. No weekly tick: posters are derived art.
   NOTE for integrator: add POSTER_DESKS to ui.js collectDesks(), bridge posterAction in
   onAction (like libAction), and load game/posters.js from index.html. Engine untouched. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var POSTER_PALETTES = {
  action:    { top: "#d43e12", end: "#4a0f05" },
  comedy:    { top: "#f7d34d", end: "#9c6318" },
  drama:     { top: "#2a5290", end: "#081c38" },
  horror:    { top: "#275c34", end: "#04140a" },
  scifi:     { top: "#22b8d4", end: "#251356" },
  romance:   { top: "#ef6f9f", end: "#6e1f47" },
  thriller:  { top: "#54687d", end: "#161f2a" },
  animation: { top: "#7ec3ef", end: "#124e7d" },
  fantasy:   { top: "#2f7d4f", end: "#9c700d" },
  crime:     { top: "#8c2f3d", end: "#2e0912" },
  musical:   { top: "#c74fae", end: "#4d0d55" },
  docs:      { top: "#9aa2ab", end: "#2c333a" },
  western:   { top: "#c68648", end: "#462719" },
  family:    { top: "#ebad59", end: "#574a8e" }
};
var POSTER_SEL = { filmId: null, variant: 0 }; /* studio-desk UI state, like GL/RL in ui.js */

/* ── state (lazy ensure — old saves have no S.posters) ────────── */
function postEnsure() { if (!S.posters) S.posters = {}; }

/* ── deterministic helpers (unseeded randomness would break saves) ── */
function posterHash(s) { /* FNV-1a, 32-bit */
  var h = 2166136261, i;
  s = String(s);
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function posterRng(seed) { /* mulberry32 */
  var t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    var x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function pfx(n) { return String(Math.round(n * 10) / 10); }

/* ── motif painters (each takes the seeded rng, returns SVG) ──── */
function posterStarPts(cx, cy, R) {
  var pts = [], i, ang, rr;
  for (i = 0; i < 10; i++) {
    ang = -Math.PI / 2 + (i * Math.PI) / 5;
    rr = i % 2 === 0 ? R : R * 0.42;
    pts.push(pfx(cx + rr * Math.cos(ang)) + "," + pfx(cy + rr * Math.sin(ang)));
  }
  return pts.join(" ");
}
function pMotCircle(r) {
  var n = 2 + Math.floor(r() * 2), s = "", i;
  for (i = 0; i < n; i++) {
    s += '<circle cx="' + pfx(40 + r() * 220) + '" cy="' + pfx(105 + r() * 140) + '" r="' + pfx(14 + r() * 52)
      + '" fill="#ffffff" opacity="' + (0.05 + r() * 0.1).toFixed(2) + '"/>';
  }
  return s;
}
function pMotTriangle(r) {
  return '<path d="M' + pfx(120 + r() * 60) + " " + pfx(95 + r() * 45)
    + " L" + pfx(35 + r() * 70) + " 262 L" + pfx(195 + r() * 80) + " 262 Z\" fill=\"#000000\" opacity=\"0.16\"/>";
}
function pMotStar(r) {
  var n = 1 + Math.floor(r() * 3), s = "", i;
  for (i = 0; i < n; i++) {
    s += '<polygon points="' + posterStarPts(40 + r() * 220, 100 + r() * 140, 12 + r() * 26)
      + '" fill="#ffffff" opacity="0.18"/>';
  }
  return s;
}
function pMotMountains(r) {
  var n = 3 + Math.floor(r() * 3), d = "M0 262", i;
  for (i = 0; i < n; i++) {
    d += " L" + pfx(((i + 0.5) / n) * 300) + " " + pfx(150 + r() * 70)
      + " L" + pfx(((i + 1) / n) * 300) + " 262";
  }
  return '<path d="' + d + ' Z" fill="#000000" opacity="0.24"/>';
}
function pMotSkyline(r) {
  var s = "", x = 0, w, h;
  while (x < 296) {
    w = 18 + r() * 26;
    h = 28 + r() * 72;
    s += '<rect x="' + pfx(x) + '" y="' + pfx(262 - h) + '" width="' + pfx(Math.min(w, 296 - x))
      + '" height="' + pfx(h) + '" fill="#000000" opacity="0.28"/>';
    x += w + 3 + r() * 8;
  }
  return s;
}
function pMotBars(r) {
  var n = 4 + Math.floor(r() * 3), s = "", i, h;
  for (i = 0; i < n; i++) {
    h = 30 + r() * 95;
    s += '<rect x="' + pfx(24 + i * (252 / n) + r() * 8) + '" y="' + pfx(262 - h)
      + '" width="' + pfx(10 + r() * 14) + '" height="' + pfx(h) + '" fill="#ffffff" opacity="0.10"/>';
  }
  return s;
}
var POSTER_MOTIFS = [pMotCircle, pMotTriangle, pMotStar, pMotMountains, pMotSkyline, pMotBars];

/* ── text helpers ─────────────────────────────────────────────── */
/* Gold on dark/cool bottoms; white when the bottom stop is warm/yellow or very light. */
function posterTitleFill(end) {
  var r = parseInt(end.slice(1, 3), 16), g = parseInt(end.slice(3, 5), 16), b = parseInt(end.slice(5, 7), 16);
  var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.55 || (r >= 140 && g >= 90 && b < g * 0.7)) return "#ffffff";
  return "#f5c518";
}
function posterWrapLines(title) { /* uppercase, ≤11 chars/line, max 3 lines */
  var words = String(title || "Untitled").toUpperCase().split(/\s+/);
  var pieces = [], i, w, lines = [], cur = "";
  for (i = 0; i < words.length; i++) {
    w = words[i];
    while (w.length > 11) { pieces.push(w.slice(0, 11)); w = w.slice(11); }
    if (w) pieces.push(w);
  }
  for (i = 0; i < pieces.length; i++) {
    if (cur && (cur + " " + pieces[i]).length > 11) { lines.push(cur); cur = pieces[i]; }
    else cur = cur ? cur + " " + pieces[i] : pieces[i];
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) lines = [lines[0], lines[1], lines.slice(2).join(" ")];
  return lines.length ? lines : ["UNTITLED"];
}
function posterMonogram(name) {
  var words = String(name || "Studio").trim().split(/\s+/), m = "";
  if (words.length && words[0]) m += words[0].charAt(0);
  if (words.length > 1 && words[words.length - 1]) m += words[words.length - 1].charAt(0);
  m = m.toUpperCase();
  return m || "S";
}

/* ── the poster itself (PURE: reads S, writes nothing) ────────── */
function posterSVG(f, variant) {
  if (!f) return "";
  var pal = POSTER_PALETTES[f.genre] || POSTER_PALETTES.drama;
  var off = 0;
  if (variant != null) off = variant;
  else if (S && S.posters && typeof S.posters[f.id] === "number") off = S.posters[f.id];
  off = clamp(off % 4, 0, 3);
  var seed = (posterHash(String(f.id)) + off * 7919) >>> 0;
  var r = posterRng(seed);
  var gid = "pg" + seed.toString(36);
  var fill = posterTitleFill(pal.end);
  var n = 3 + Math.floor(r() * 3), m, art = "";
  for (m = 0; m < n; m++) art += POSTER_MOTIFS[Math.floor(r() * 6)](r);
  var lines = posterWrapLines(f.title);
  var fs = lines.length >= 3 ? 20 : 26;
  var step = lines.length >= 3 ? 25 : 32;
  var y = lines.length >= 3 ? 284 : 298;
  var titleHtml = "";
  for (m = 0; m < lines.length; m++) {
    titleHtml += '<text x="150" y="' + y + '" text-anchor="middle" font-family="Georgia, serif" font-size="'
      + fs + '" font-weight="bold" letter-spacing="3" fill="' + fill + '">' + esc(lines[m]) + "</text>";
    y += step;
  }
  var credit = ("A " + ((S && S.studio && S.studio.name) || "Lighthouse") + " PICTURE").toUpperCase();
  var cfs = credit.length > 30 ? 8 : 9.5;
  var yr = Math.max(1, Math.ceil((f.releaseWeek || 1) / ((typeof WEEKS_PER_YEAR === "number") ? WEEKS_PER_YEAR : 52)));
  return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450" style="width:100%;height:auto;display:block">'
    + "<title>" + esc(f.title) + "</title>"
    + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="' + pal.top + '"/><stop offset="1" stop-color="' + pal.end + '"/></linearGradient></defs>'
    + '<rect width="300" height="450" fill="url(#' + gid + ')"/>'
    + '<rect x="7" y="7" width="286" height="436" fill="none" stroke="#f5c518" stroke-opacity="0.3"/>'
    + art
    + '<text x="150" y="152" text-anchor="middle" font-size="104" opacity="0.15">' + esc(genreOf(f.genre).em) + "</text>"
    + titleHtml
    + '<circle cx="150" cy="378" r="16" fill="none" stroke="#f5c518" stroke-opacity="0.7"/>'
    + '<text x="150" y="383" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="bold" letter-spacing="1" fill="#f5c518">'
    + esc(posterMonogram(S && S.studio ? S.studio.name : "")) + "</text>"
    + '<text x="150" y="412" text-anchor="middle" font-family="Georgia, serif" font-size="' + cfs
    + '" letter-spacing="2" fill="#ffffff" fill-opacity="0.78">' + esc(credit) + "</text>"
    + '<text x="150" y="436" text-anchor="middle" font-family="Georgia, serif" font-size="11" letter-spacing="3" fill="#f5c518">YEAR ' + yr + "</text>"
    + "</svg>";
}

/* ── shared desk helpers ──────────────────────────────────────── */
function posterGross(f) {
  if (f.ww != null && isFinite(f.ww)) return f.ww;
  if (f.dom != null && isFinite(f.dom)) return f.dom;
  return f.opening || 0;
}
function posterTopFilms() {
  var list = S.films.slice();
  list.sort(function (a, b) { return posterGross(b) - posterGross(a); });
  return list.slice(0, 12);
}
function posterSetCount() {
  var n = 0, k;
  for (k in S.posters) if (typeof S.posters[k] === "number") n++;
  return n;
}

/* ── desks ("The lobby") ──────────────────────────────────────── */
function postersWallDesk() {
  postEnsure();
  var list = posterTopFilms(), i;
  if (!list.length) return '<div class="card"><div class="empty"><span class="em">🖼️</span>No posters yet — release a film and its one-sheet goes up on the wall.</div></div>';
  var html = '<div class="card">' + statrow("Highest-grossing films", list.length)
    + '</div><div class="deskgrid" style="margin-top:10px">';
  for (i = 0; i < list.length; i++) {
    html += '<div class="card" style="padding:6px 6px 0">' + posterSVG(list[i])
      + statrow(genreOf(list[i].genre).em + " " + esc(list[i].title), fm(posterGross(list[i]))) + "</div>";
  }
  return html + "</div>";
}
function postersStudioDesk() {
  postEnsure();
  if (!S.films.length) return '<div class="card"><div class="empty"><span class="em">🎨</span>No released films yet — the studio designs posters for films that have premiered.</div></div>';
  var f = findFilm(POSTER_SEL.filmId), i, fl;
  var html = '<div class="card">' + statrow("Released films", S.films.length)
    + statrow("Official posters set", posterSetCount()) + "</div>";
  if (!f) {
    html += '<div class="sechead"><h2>Pick a film</h2></div><div class="talent-row">';
    for (i = 0; i < S.films.length; i++) {
      fl = S.films[i];
      html += '<button class="person" data-action="poster-pick" data-id="' + fl.id + '"><div class="nm">'
        + genreOf(fl.genre).em + " " + esc(fl.title) + '</div><div class="st">'
        + (fl.status === "run" ? "In theaters" : "Run ended") + '</div><div class="fee">Design</div></button>';
    }
    return html + "</div>";
  }
  var v = clamp(POSTER_SEL.variant || 0, 0, 3);
  html += '<div class="sechead"><h2>' + genreOf(f.genre).em + " " + esc(f.title) + "</h2></div>"
    + '<div class="card" style="padding:8px;text-align:center">' + posterSVG(f, v) + "</div>"
    + '<div class="sechead"><h2>Palette &amp; style variants</h2></div><div class="card"><div class="seg">';
  for (i = 0; i < 4; i++) {
    html += '<button class="' + (v === i ? "on" : "") + '" data-action="poster-variant" data-key="' + i + '">V' + (i + 1) + "</button>";
  }
  html += statrow("Official poster", typeof S.posters[f.id] === "number" ? "Variant " + (S.posters[f.id] + 1) : "Default (variant 1)")
    + '</div><div class="foot btnrow"><button class="btn primary grow" data-action="poster-set">Set as official poster</button></div>';
  return html;
}

/* ── action delegation (ui.js onAction calls posterAction first) ── */
function posterCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function posterAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("poster-") !== 0) return false;
  postEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  if (a === "poster-pick") {
    if (!findFilm(id)) { toast("That film is no longer on the slate.", "bad"); return true; }
    POSTER_SEL = { filmId: id, variant: typeof S.posters[id] === "number" ? S.posters[id] : 0 };
    return true;
  }
  if (a === "poster-variant") {
    if (!POSTER_SEL.filmId) return true;
    POSTER_SEL.variant = clamp(parseInt(key, 10) || 0, 0, 3);
    return true;
  }
  if (a === "poster-set") {
    if (!POSTER_SEL.filmId) return true;
    var f = findFilm(POSTER_SEL.filmId);
    S.posters[POSTER_SEL.filmId] = clamp(POSTER_SEL.variant || 0, 0, 3);
    if (f) toast("🖼️ Official poster set for “" + f.title + "”.", "good");
    posterCommit();
    return true;
  }
  return false;
}

var POSTER_DESKS = [
  { id: "posters-wall", group: "The lobby", icon: "🖼️", name: "Poster wall", desc: "One-sheets for your twelve highest-grossing films, drawn as they played.", render: postersWallDesk },
  { id: "posters-studio", group: "The lobby", icon: "🎨", name: "Poster studio", desc: "Pick a released film, try four palette variants, set its official poster.", render: postersStudioDesk }
];
