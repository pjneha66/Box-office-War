/* Box Office War — rebuilt. UI layer: plain string templates + event delegation.
   Views: start · studio · develop · playing · ledger · gameover. One bottom sheet, one toast queue. */
"use strict";

var VIEW = "studio";
var DEV_TAB = "scripts";
var selOrigin = "veteran";
var selDiff = "std";
var selScenario = "free";
function themeName(id) { for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i].n; return ""; }
var GL = null;   // greenlight sheet state
var RL = null;   // release sheet state
var CONFIRM = null;
var EXPORT_MODE = false;
var toastQ = [], toastOn = false, toastTimer = null;

function $(sel) { return document.querySelector(sel); }
function el(id) { return document.getElementById(id); }

/* ── toasts ───────────────────────────────────────────────────── */
function pushToast(txt, kind) {
  toastQ.push({ txt: txt, kind: kind || "" });
  if (!toastOn) nextToast();
}
/* ── preferences (theme / accent / font scale) ───────────────── */
var PREFS = {};
try { PREFS = JSON.parse(localStorage.getItem("bow2.prefs") || "{}") || {}; } catch (e) { PREFS = {}; }
function setPref(k, v) {
  PREFS[k] = v;
  try { localStorage.setItem("bow2.prefs", JSON.stringify(PREFS)); } catch (e) {}
  applyPrefs();
}
function applyPrefs() {
  var b = document.body;
  b.setAttribute("data-theme", PREFS.theme || "dark");
  b.setAttribute("data-accent", PREFS.accent || "gold");
  b.style.fontSize = (PREFS.font || 100) + "%";
}

function nextToast() {
  var n = toastQ.shift();
  if (!n) { toastOn = false; return; }
  toastOn = true;
  var t = el("toast");
  t.textContent = n.txt;
  t.className = n.kind;
  t.hidden = false;
  if (typeof sfx === "function") sfx(n.kind === "gold" ? "gold" : n.kind);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; nextToast(); }, 2500);
}
function drainFlash() {
  if (S && S.flash && S.flash.length) {
    S.flash.forEach(function (t) { pushToast(t.txt, t.kind); });
    S.flash = [];
  }
}

/* ── sheet ────────────────────────────────────────────────────── */
function openSheet(html) {
  el("sheetBody").innerHTML = html;
  el("sheetWrap").hidden = false;
  toastQ = []; toastOn = false;
  clearTimeout(toastTimer);
  el("toast").hidden = true;
}
function rerenderSheet(html) {
  var b = el("sheetBody"), st = b.scrollTop;
  b.innerHTML = html; b.scrollTop = st;
}
function closeSheet() {
  el("sheetWrap").hidden = true;
  GL = null; RL = null; CONFIRM = null; EXPORT_MODE = false;
}

/* ── hud ──────────────────────────────────────────────────────── */
var lastCash = null;
function paintHud() {
  var st = S.studio;
  el("hudStudio").textContent = st.name;
  var cashEl = el("hudCash");
  cashEl.textContent = fm(st.cash);
  if (lastCash !== null && Math.abs(st.cash - lastCash) > 0.05) {
    cashEl.classList.remove("pulse-good", "pulse-bad");
    void cashEl.offsetWidth;
    cashEl.classList.add(st.cash >= lastCash ? "pulse-good" : "pulse-bad");
  }
  lastCash = st.cash;
  el("hudRep").textContent = "★ " + Math.round(st.rep);
  el("hudWeek").textContent = "Y" + st.year + "·W" + st.woy;
}

/* ── shared fragments ─────────────────────────────────────────── */
function tag(txt, cls) { return '<span class="tag ' + (cls || "") + '">' + txt + "</span>"; }
function statrow(k, v, cls) { return '<div class="statrow"><span class="k">' + k + '</span><span class="v num ' + (cls || "") + '">' + v + "</span></div>"; }
function phaseName(p) { return { pre: "Pre-production", shoot: "Shooting", post: "Post-production", ready: "Ready to release" }[p] || p; }
function projProgress(p) {
  var sc = scaleOf(p.scale);
  var total = p.phaseLen.pre + p.phaseLen.shoot + p.phaseLen.post;
  var done = p.phase === "pre" ? p.phaseWk : p.phase === "shoot" ? p.phaseLen.pre + p.phaseWk : p.phaseLen.pre + p.phaseLen.shoot + p.phaseWk;
  return clamp(Math.round(done / total * 100), 0, 100);
}
function chartHTML(rows) {
  if (!rows.length) return '<div class="empty"><span class="em">🎞️</span>No films in theaters this week.</div>';
  var max = 1;
  rows.forEach(function (r) { max = Math.max(max, r.gross); });
  var out = '<div class="chart">';
  rows.forEach(function (r, i) {
    var pct = Math.max(4, Math.round(r.gross / max * 100));
    var cls = (r.mine ? "me" : "") + (i === 0 ? " win" : "");
    var label = esc(r.title.length > 8 ? r.title.slice(0, 8) : r.title);
    out += '<div class="c ' + cls + '"><i style="height:' + pct + '%"></i><span>' + label + "</span></div>";
  });
  return out + "</div>";
}

/* ── start screen ─────────────────────────────────────────────── */
function vStart() {
  var hasSave = S && !S.over;
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem("bow2.legacy.v1") || "null"); } catch (e) {}
  var html = '<div class="start">'
    + '<div class="marquee"><div class="eyebrow">A HOLLYWOOD STUDIO TYCOON</div>'
    + '<h1>BOX OFFICE <em>WAR</em></h1>'
    + '<div class="tagline">Greenlight films. Cast stars. Win the weekend.</div></div>'
    + '<div class="card">';
  if (legacy && legacy.score >= 500) {
    html += '<div class="card" style="border-color:rgba(245,197,24,.45);padding:10px 14px"><div class="statrow"><span class="k">👑 Dynasty of ' + esc(legacy.name) + '</span><span class="v num">score ' + legacy.score + '</span></div><div class="empty" style="padding:4px 0 0">Your next studio inherits capital and reputation.</div></div>';
  }
  if (hasSave) {
    html += '<button class="btn primary block" data-action="resume">' + esc(S.studio.name) + " — Year " + S.studio.year + ", " + fm(S.studio.cash) + ' — tap to continue</button>'
      + '<div class="field-label" style="margin-top:14px">or start a new studio</div>';
  }
  if (typeof window !== "undefined" && window.__deferredPrompt) {
    html += '<button class="btn block" data-action="pwa-install" style="margin-top:12px">📲 Install as an app</button>';
  }
  html += '<label class="field-label" for="studioName">Studio name</label>'
    + '<input id="studioName" class="text-input" maxlength="26" placeholder="e.g. Lighthouse Pictures">'
    + '<div class="field-label" style="margin-top:16px">Origin</div>'
    + '<div class="origin">';
  ORIGINS.forEach(function (o) {
    html += '<button data-action="pick-origin" data-origin="' + o.id + '" class="' + (selOrigin === o.id ? "on" : "") + '">'
      + '<div class="nm">' + o.name + " · " + fm(o.cash) + "</div>"
      + '<div class="ds">' + o.perk + " Weekly overhead " + fm(o.overhead) + ".</div></button>";
  });
  html += "</div>"
  if (typeof slotPickerHTML === "function") html += slotPickerHTML();
  html += '<div class="field-label" style="margin-top:16px">Scenario</div><div class="origin">'
    + SCENARIOS.map(function (sc) {
      return '<button data-action="pick-scenario" data-scenario="' + sc.id + '" class="' + (selScenario === sc.id ? "on" : "") + '">'
        + '<div class="nm">' + sc.n + "</div><div class='ds'>" + sc.d + "</div></button>";
    }).join("")
    + "</div>"
    + '<div class="field-label" style="margin-top:16px">Difficulty</div>'
    + '<div class="seg">'
    + '<button class="' + (selDiff === "easy" ? "on" : "") + '" data-action="pick-diff" data-diff="easy">Easy</button>'
    + '<button class="' + (selDiff === "std" ? "on" : "") + '" data-action="pick-diff" data-diff="std">Standard</button>'
    + '<button class="' + (selDiff === "hard" ? "on" : "") + '" data-action="pick-diff" data-diff="hard">Hard</button>'
    + "</div>"
    + '<button class="btn primary block" style="margin-top:16px" data-action="start-game">' + t("Open the studio") + "</button>"
    + '<div class="empty" style="padding:12px 6px 0">Autosaves after every week · plays offline</div>'
    + "</div></div>";
  return html;
}

/* ── studio (home) ────────────────────────────────────────────── */
function readyProjects() { return S.projects.filter(function (p) { return p.phase === "ready"; }); }

function projCard(p, compact) {
  var dir = findTalent(p.dirId), act = findTalent(p.actId);
  var g = genreOf(p.genre), pct = projProgress(p);
  var html = '<div class="card film">'
    + '<div class="head"><div class="title">' + g.em + " " + esc(p.title) + '</div>'
    + tag(phaseName(p.phase), p.phase === "ready" ? "gold" : "") + "</div>"
    + '<div class="bar"><i style="width:' + pct + '%"></i></div>'
    + '<div class="meta">'
    + tag(fm(p.budgetNow) + " budget")
    + (p.overrun ? tag(p.overrun + "× overrun", "red") : "")
    + (p.scandal ? tag("Scandal", "red") : "")
    + (p.buzz ? tag("Buzz +" + p.buzz, "blue") : "");
  if (compact) {
    html += "</div></div>";
    return html;
  }
  html += tag(g.name) + tag(scaleOf(p.scale).name)
    + "</div>"
    + '<div class="statrow"><span class="k">Director</span><span class="v">' + esc(dir ? dir.n : "—") + "</span></div>"
    + '<div class="statrow"><span class="k">Lead</span><span class="v">' + esc(act ? act.n : "—") + "</span></div>";
  if (p.phase === "ready" && p.qPreview) {
    html += '<div class="statrow"><span class="k">Internal screening</span><span class="v">' + p.qPreview + "/100</span></div>";
  }
  html += '<div class="foot">';
  if (p.phase === "ready") html += '<button class="btn primary sm grow" data-action="rl-open" data-id="' + p.id + '">' + t("Set release date") + "</button>"
    + (p.recut ? tag("Recut for crowds", "blue") : '<button class="btn sm" data-action="proj-recut" data-id="' + p.id + '">Recut · $2M</button>');
  else if (p.phase === "pre" || p.phase === "shoot") html += '<span class="tag">' + (p.phaseLen[p.phase] - p.phaseWk) + " wk left · " + fm(p.budgetNow * (p.phase === "pre" ? 0.10 : 0.70) / p.phaseLen[p.phase]) + "/wk</span>"
    + (p.cleared ? tag("Titles cleared", "green") : '<button class="btn sm" data-action="proj-clear" data-id="' + p.id + '">Clear titles · $1.5M</button>');
  else html += '<span class="tag">' + (p.phaseLen[p.phase] - p.phaseWk) + " wk left · " + fm(p.budgetNow * 0.20 / p.phaseLen[p.phase]) + "/wk</span>";
  html += "</div></div>";
  return html;
}

function vStudio() {
  var st = S.studio, tx = S.txHistory[0];
  var net = tx ? tx.in - tx.out : 0;
  var html = "";
  var ready = readyProjects();
  if (ready.length) {
    html += '<div class="card film" style="border-color:rgba(245,197,24,.45)">'
      + '<div class="head"><div class="title">🎬 ' + ready.length + " film" + (ready.length > 1 ? "s" : "") + " awaiting a release date</div></div>"
      + '<div class="foot">';
    ready.forEach(function (p) {
      html += '<button class="btn primary sm" data-action="rl-open" data-id="' + p.id + '">' + esc(p.title) + "</button>";
    });
    html += "</div></div>";
  }
  html += '<div class="card hero"><div class="val num">' + fm(st.cash) + '</div><div class="lbl">' + t("cash on hand") + "</div>"
    + '<div class="sub">This week <b class="' + (net >= 0 ? "up" : "down") + '">' + (net >= 0 ? "+" : "") + fm(net) + "</b>"
    + " · Catalog " + fm(st.catalog) + " · Lifetime gross " + fm(st.lifetime) + "</div></div>";
  if (typeof mastGenreTier === "function") {
    var known = [];
    GENRES.forEach(function (g) { var lv = mastGenreTier(g.id); if (lv) known.push(g.em + " " + g.name + " · " + lv.n); });
    if (known.length) html += '<div class="card">' + statrow("Known for (genre mastery)", known.join(" · ")) + "</div>";
  }

  if (S.projects.length) {
    html += '<div class="sechead"><h2>' + t("In production") + "</h2></div>";
    S.projects.forEach(function (p) { html += projCard(p, true); });
  }
  html += '<div class="sechead"><h2>' + t("The trade papers") + "</h2></div><div class=\"card pad0\">";
  if (!S.news.length) html += '<div class="news-item"><span class="ico">🗞️</span><div>All quiet on the lot.</div></div>';
  S.news.slice(0, 7).forEach(function (n) {
    html += '<div class="news-item ' + n.kind + '"><span class="ico">' + (n.ico || "🗞️") + "</span><div>" + esc(n.txt) + '<div class="when">Y' + n.y + " · W" + woyOf(n.w) + "</div></div></div>";
  });
  html += "</div>";

  html += '<div class="sechead"><h2>' + t("Rival studios") + "</h2></div><div class=\"card\">";
  S.rivals.forEach(function (r) {
    var next = null;
    r.slots.forEach(function (s) { if (!next && !s.done && s.announced && s.week > st.week) next = s; });
    html += statrow(r.name, fm(r.ytd) + " ytd" + (next ? ' · next: <b>' + esc(next.title) + "</b> W" + woyOf(next.week) : ""), "");
  });
  html += "</div>";
  return html;
}

/* ── develop ──────────────────────────────────────────────────── */
function ideaCard(idea) {
  var g = genreOf(idea.genre);
  return '<div class="card film">'
    + '<div class="head"><div class="title">' + g.em + " " + esc(idea.title) + "</div>" + tag(fm(idea.price), "gold") + "</div>"
    + '<div class="meta">' + tag(g.name) + tag("Script ✦ " + idea.script, idea.script >= 75 ? "green" : "") + (idea.theme ? tag("✦ " + esc(themeName(idea.theme))) : "") + (idea.local ? tag("Local-language", "blue") : "") + (idea.franchiseOf ? tag("Sequel pitch", "blue") : "") + "</div>"
    + '<div class="foot"><button class="btn primary sm grow" data-action="gl-open" data-id="' + idea.id + '">' + t("Greenlight") + "</button></div>"
    + "</div>";
}

function vDevelop() {
  var html = '<div class="seg" style="flex-wrap:wrap">'
    + '<button class="' + (DEV_TAB === "scripts" ? "on" : "") + '" data-action="dev-tab" data-tab="scripts">' + t("Scripts") + " (" + S.ideas.length + ')</button>'
    + '<button class="' + (DEV_TAB === "slate" ? "on" : "") + '" data-action="dev-tab" data-tab="slate">' + t("Slate") + " (" + S.projects.length + ')</button>'
    + '<button class="' + (DEV_TAB === "series" ? "on" : "") + '" data-action="dev-tab" data-tab="series">' + t("Series") + " (" + S.series.length + ')</button>'
    + "</div>";
  if (DEV_TAB === "scripts") {
    S.ideas.forEach(function (i) { html += ideaCard(i); });
    html += '<div class="btnrow">'
      + '<button class="btn block" data-action="scout">Scout new scripts · $1M</button>'
      + '<button class="btn block" data-action="pitch-open">💡 Pitch a project · $2M</button>'
      + "</div>";
  } else if (DEV_TAB === "series") {
    html += vSeriesDesk();
  } else {
    if (!S.projects.length) html += '<div class="card empty"><span class="em">🎬</span>Nothing in production. Buy a script and greenlight it.</div>';
    S.projects.forEach(function (p) { html += projCard(p, false); });
  }
  return html;
}

/* ── series desk: greenlight → shoot → air → sell to a streamer or keep exclusive ── */
var SE_UI = { genre: "drama", bIdx: 1 };
var SE_BUYERS = ["StreamFlix", "PrimeWave+", "HuluTown", "MaxMotion", "AppleGrove+"];
function seBuyerFor(p) { var n = parseInt(String(p.id).replace(/\D/g, ""), 10) || 0; return SE_BUYERS[n % SE_BUYERS.length]; }
function vSeriesDesk() {
  var html = '<div class="card"><div class="field-label">Greenlight a limited series</div><div class="seg" style="flex-wrap:wrap">';
  GENRES.forEach(function (g) {
    html += '<button class="' + (SE_UI.genre === g.id ? "on" : "") + '" data-action="se-genre" data-genre="' + g.id + '">' + g.em + " " + g.name + "</button>";
  });
  html += '</div><div class="field-label" style="margin-top:10px">Budget</div><div class="seg">';
  SERIES_BUDGETS.forEach(function (b, i) {
    html += '<button class="' + (SE_UI.bIdx === i ? "on" : "") + '" data-action="se-budget" data-idx="' + i + '">' + fm(b) + "</button>";
  });
  html += '</div><div class="btnrow" style="margin-top:12px">'
    + '<button class="btn primary grow" data-action="se-go" ' + (S.series.length >= 3 || S.studio.cash < SERIES_BUDGETS[SE_UI.bIdx] ? "disabled" : "") + '">📺 Greenlight series</button></div>'
    + '<div class="empty" style="padding:8px 0 0">A series shoots for a few weeks, then airs weekly episode by episode. When the finale lands: sell the rights to a streamer for a lump sum, or keep it exclusive on your own platform (More → Streaming desk).</div></div>';
  if (!S.series.length) html += '<div class="card empty"><span class="em">📺</span>No series yet. Greenlight one above — up to three at once.</div>';
  S.series.forEach(function (p) {
    var g = genreOf(p.genre);
    var badge = p.done ? (p.outlet === "sold" ? tag("Sold · " + seBuyerFor(p), "blue") : p.outlet === "streamer" ? tag("Streamer exclusive", "gold") : tag("Finale aired — pick a deal", "gold")) : p.phase === "shooting" ? tag("Shooting · " + Math.max(0, p.shootLen - p.phaseWk) + " wk left") : tag("Airing · ep " + Math.min(p.weeksOut, p.eps) + "/" + p.eps, "blue");
    html += '<div class="card film"><div class="head"><div class="title">' + g.em + " " + esc(p.title) + "</div>" + badge + "</div>"
      + '<div class="meta">' + tag(g.name) + tag(fm(p.budget) + " budget") + (p.rating != null ? tag("Rating " + p.rating, p.rating >= 70 ? "green" : "") : "") + "</div>";
    if (p.done && !p.outlet) {
      var offer = Math.round((p.grossSum * 0.9 + p.rating * 0.35 + g.mass * 4) * 10) / 10;
      html += '<div class="statrow"><span class="k">Run total · rating ' + p.rating + '</span><span class="v num">' + fm(p.grossSum) + "</span></div>"
        + '<div class="foot btnrow">'
        + '<button class="btn primary sm grow" data-action="se-sell" data-id="' + p.id + '">💸 Sell to ' + seBuyerFor(p) + " · " + fm(offer) + "</button>"
        + '<button class="btn sm" data-action="se-stream" data-id="' + p.id + '">📺 Own platform</button></div>';
    } else if (p.done) {
      html += '<div class="statrow"><span class="k">Run total · rating ' + p.rating + '</span><span class="v num">' + fm(p.grossSum) + "</span></div>";
    }
    html += "</div>";
  });
  return html;
}

/* ── pitch sheet: develop your own concept ─────────────────── */
var PITCH = { genre: "action", theme: null };
function sheetPitch() {
  var html = '<div class="sheet-head"><h3>💡 Pitch a project</h3>'
    + '<button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">';
  html += '<div class="card">Skip the scouts — develop your own concept for $2M. It lands on the scripts desk like any other buy, then greenlights as usual.</div>';
  html += '<div class="field-label">Genre</div><div class="seg" style="flex-wrap:wrap">';
  GENRES.forEach(function (g) {
    html += '<button class="' + (PITCH.genre === g.id ? "on" : "") + '" data-action="pitch-genre" data-genre="' + g.id + '">' + g.em + " " + g.name + "</button>";
  });
  html += '</div><div class="field-label" style="margin-top:10px">Theme (optional — +5 quality when it loves the genre)</div><div class="seg" style="flex-wrap:wrap">';
  html += '<button class="' + (PITCH.theme == null ? "on" : "") + '" data-action="pitch-theme" data-theme="">No theme</button>';
  THEMES.forEach(function (th) {
    html += '<button class="' + (PITCH.theme === th.id ? "on" : "") + '" data-action="pitch-theme" data-theme="' + th.id + '">' + esc(th.n) + "</button>";
  });
  html += '</div><div class="field-label" style="margin-top:10px">Working title (optional)</div>'
    + '<input id="pitchTitle" class="text-input" maxlength="40" placeholder="Leave blank for a studio title">';
  html += '</div><div class="sheet-foot"><div class="proj">Cost <b>$2M</b> · cash after <b>' + fm(S.studio.cash - 2) + "</b></div>"
    + '<button class="btn primary" data-action="pitch-go" ' + (S.studio.cash >= 2 && S.ideas.length < 8 ? "" : "disabled") + ">Develop pitch</button></div>";
  openSheet(html);
}

/* ── playing (box office) ─────────────────────────────────────── */
function filmCard(f) {
  var g = genreOf(f.genre);
  var wk = f.weekly.length ? f.weekly[f.weekly.length - 1] : f.opening;
  var share = clamp(g.intl + (typeof bizIntlBonus === "function" ? bizIntlBonus() : 0), 0.1, 0.8);
  var wwEst = f.ww != null ? f.ww : Math.round(f.dom * (1 + share) / (1 - share) * 10) / 10;
  var html = '<div class="card film" data-action="film-open" data-id="' + f.id + '">'
    + '<div class="head"><div class="title">' + g.em + " " + esc(f.title) + "</div>" + tag(f.weeksOut === 0 ? "Opening weekend" : "Week " + (f.weeksOut + 1), "blue") + "</div>"
    + '<div class="meta">' + tag(fm(wk) + " this wk", "gold") + tag(fm(f.dom) + " domestic") + tag(fm(wwEst) + (f.ww != null ? " worldwide" : " worldwide est")) + tag(fm(f.cost) + " budget", f.dom >= f.cost ? "green" : "") + (f.franchiseOf ? tag("Sequel", "blue") : "") + "</div>";
  if (f.criticAvg != null) html += '<div class="meta">' + tag("Critics " + f.criticAvg + "%", f.criticAvg >= 60 ? "green" : "red") + tag("Audience " + f.aud + "%", f.aud >= 60 ? "green" : "red") + "</div>";
  html += '<div class="bar"><i style="width:' + clamp(Math.round(wk / Math.max(f.opening, 1) * 100), 3, 100) + '%"></i></div></div>';
  return html;
}

function vPlaying() {
  var st = S.studio, season = seasonOf(st.woy);
  var html = '<div class="sechead"><h2>' + t("Weekend chart") + " · " + season.name + "</h2></div>"
    + '<div class="card">' + chartHTML(weeklyChart()) + "</div>";
  var mine = S.films.filter(function (f) { return f.status === "run"; });
  html += '<div class="sechead"><h2>' + t("Your films in theaters") + "</h2></div>";
  if (!mine.length) html += '<div class="card empty"><span class="em">🎟️</span>Nothing playing. Schedule a release from the Develop slate.</div>';
  mine.forEach(function (f) { html += filmCard(f); });
  html += '<div class="sechead"><h2>' + t("Release calendar") + "</h2></div><div class=\"card\">";
  var rows = "", w, i;
  for (w = st.week; w <= st.week + 7; w++) {
    var items = [];
    S.rivals.forEach(function (r) {
      r.slots.forEach(function (s) { if (s.week === w && s.announced && !s.done) items.push('<span class="tag red">⚠ ' + esc(s.title) + "</span>"); });
    });
    S.projects.forEach(function (p) { if (p.releaseWeek === w) items.push('<span class="tag gold">★ ' + esc(p.title) + "</span>"); });
    if (items.length) rows += statrow((w === st.week ? "This week" : "+" + (w - st.week) + " wk"), items.join(" "));
  }
  html += rows || '<div class="empty">No announced releases in the next 8 weeks. A clear field.</div>';
  html += "</div>";
  return html;
}

/* ── ledger ───────────────────────────────────────────────────── */
function vLedger() {
  var st = S.studio;
  var html = '<div class="card hero"><div class="val num">' + fm(st.cash) + '</div><div class="lbl">cash on hand</div></div>';

  html += '<div class="sechead"><h2>Weekly P&L · last ' + Math.max(S.txHistory.length, 1) + '</h2></div><div class="card">';
  if (S.txHistory.length) {
    var max = 1;
    S.txHistory.forEach(function (t) { max = Math.max(max, t.in, t.out); });
    html += '<div class="chart">';
    S.txHistory.slice().reverse().forEach(function (t) {
      var inH = Math.max(3, Math.round(t.in / max * 92)), outH = Math.max(3, Math.round(t.out / max * 92));
      html += '<div class="c"><i style="height:' + inH + 'px;background:var(--green)"></i><i style="height:' + outH + 'px;background:var(--red)"></i><span>W' + woyOf(t.w) + "</span></div>";
    });
    html += "</div>";
  } else html += '<div class="empty">No transactions yet.</div>';
  html += "</div>";

  html += '<div class="sechead"><h2>Genre economics</h2></div><div class="card">';
  var byG = {};
  S.films.forEach(function (f) {
    if (f.status !== "done" || !f.ww) return;
    var k = f.genre;
    byG[k] = byG[k] || { n: 0, ww: 0, profit: 0, cost: 0 };
    byG[k].n++; byG[k].ww += f.ww; byG[k].cost += f.cost; byG[k].profit += (f.profit || 0);
  });
  var gKeys = Object.keys(byG);
  if (!gKeys.length) html += '<div class="empty">No finished films yet.</div>';
  gKeys.sort(function (a, b) { return byG[b].ww - byG[a].ww; }).slice(0, 8).forEach(function (k) {
    var gg = byG[k], roi = gg.cost > 0 ? gg.profit / gg.cost : 0;
    html += statrow(genreOf(k).em + " " + genreOf(k).name + " · " + gg.n + " film" + (gg.n > 1 ? "s" : ""),
      fm(gg.ww) + ' · <span class="' + (roi >= 0 ? "up" : "down") + '">' + (roi >= 0 ? "+" : "") + Math.round(roi * 100) + "%</span>");
  });
  html += "</div>";

  var fc = forecast12();
  var netSum = 0, worst = 0, best = 0;
  fc.forEach(function (r) { var n = r.inn - r.out; netSum += n; if (n < worst) worst = n; if (n > best) best = n; });
  html += '<div class="sechead"><h2>12-week forecast</h2></div><div class="card">'
    + statrow("Projected net", (netSum >= 0 ? "+" : "") + fm(netSum), netSum >= 0 ? "up" : "down")
    + statrow("Best week", fm(best))
    + statrow("Worst week", fm(worst))
    + "</div>";

  if (S.loans.length || st.cash < 10 || S.mezz) {
    html += '<div class="sechead"><h2>Bank</h2></div><div class="card">';
    S.loans.forEach(function (l) { html += statrow("Loan outstanding", fm(l.amt) + " · " + (l.rate * 100).toFixed(1) + "%/wk", "down"); });
    html += statrow("Mezzanine facility", fm(S.mezz || 0) + " drawn · 1.2%/wk", S.mezz ? "down" : "");
    html += '<div class="foot btnrow">';
    if (S.loans.length) html += '<button class="btn sm" data-action="repay" ' + (st.cash < 30 ? "disabled" : "") + ">Repay $30M</button>";
    if (S.loans.length < 2) html += '<button class="btn danger sm" data-action="loan">Emergency loan +$30M</button>';
    if ((S.mezz || 0) < 60) html += '<button class="btn sm" data-action="mezz-draw">Mezz +$20M</button>';
    if ((S.mezz || 0) > 0) html += '<button class="btn sm" data-action="mezz-repay" ' + (st.cash < 20 ? "disabled" : "") + ">Repay mezz $20M</button>";
    html += "</div></div>";
  }

  html += '<div class="sechead"><h2>Studio record</h2></div><div class="card">'
    + statrow("Releases", S.stats.releases)
    + statrow("Hits / Flops", S.stats.hits + " / " + S.stats.flops)
    + statrow("Best opening", fm(S.stats.bestOpen))
    + statrow("Best worldwide", fm(S.stats.bestWW))
    + statrow("Lifetime gross", fm(st.lifetime))
    + statrow("Library value", fm(st.catalog))
    + statrow("Reputation", Math.round(st.rep) + " / 100")
    + statrow("Career code", (S.stats.releases * 7 + S.stats.hits * 13 + Math.round(st.rep * 29) + st.week).toString(36).toUpperCase() + "-" + Math.round(st.lifetime).toString(36).toUpperCase())
    + "</div>";

  html += '<div class="sechead"><h2>Facilities</h2></div><div class="card">';
  ["post", "backlot"].forEach(function (k) {
    var u = UPGRADES[k], lv = S.upg[k], cost = upgradeCost(k);
    var dots = "●".repeat(lv) + "○".repeat(u.levels.length - lv);
    html += '<div class="statrow"><span class="k">' + u.name + "<br><small style='color:var(--faint)'>" + dots + (cost == null ? " · maxed" : " · next: " + u.levels[lv].desc) + "</small></span>"
      + (cost == null ? '<span class="v">Max</span>' : '<button class="btn sm" data-action="upgrade" data-key="' + k + '" ' + (st.cash < cost ? "disabled" : "") + ">" + fm(cost) + "</button>") + "</div>";
  });
  html += "</div>";

  html += '<div class="sechead"><h2>Settings</h2></div><div class="card">'
    + '<div class="btnrow">'
    + '<button class="btn sm" data-action="export-save">Save & load</button>'
    + '<button class="btn danger sm" data-action="new-game">New game</button>'
    + (canRetire() && !S.over ? '<button class="btn sm" data-action="retire-open">Retire & hand over</button>' : "")
    + "</div>"
    + '<div class="field-label" style="margin-top:12px">Theme</div><div class="seg">'
    + '<button class="' + ((PREFS.theme || "dark") === "dark" ? "on" : "") + '" data-action="set-pref" data-key="theme" data-val="dark">Dark</button>'
    + '<button class="' + (PREFS.theme === "light" ? "on" : "") + '" data-action="set-pref" data-key="theme" data-val="light">Light</button>'
    + '<button class="' + (PREFS.theme === "contrast" ? "on" : "") + '" data-action="set-pref" data-key="theme" data-val="contrast">Contrast</button>'
    + "</div>"
    + '<div class="field-label" style="margin-top:10px">Accent</div><div class="seg">'
    + '<button class="' + ((PREFS.accent || "gold") === "gold" ? "on" : "") + '" data-action="set-pref" data-key="accent" data-val="gold">Gold</button>'
    + '<button class="' + (PREFS.accent === "blue" ? "on" : "") + '" data-action="set-pref" data-key="accent" data-val="blue">Blue</button>'
    + '<button class="' + (PREFS.accent === "rose" ? "on" : "") + '" data-action="set-pref" data-key="accent" data-val="rose">Rose</button>'
    + '<button class="' + (PREFS.accent === "mint" ? "on" : "") + '" data-action="set-pref" data-key="accent" data-val="mint">Mint</button>'
    + "</div>"
    + '<div class="field-label" style="margin-top:10px">Text size</div><div class="seg">'
    + '<button class="' + ((PREFS.font || 100) === 100 ? "on" : "") + '" data-action="set-pref" data-key="font" data-val="100">A</button>'
    + '<button class="' + (PREFS.font === 112 ? "on" : "") + '" data-action="set-pref" data-key="font" data-val="112">A+</button>'
    + '<button class="' + (PREFS.font === 126 ? "on" : "") + '" data-action="set-pref" data-key="accent" data-val="126">A++</button>'.replace('data-key="accent"', 'data-key="font"')
    + "</div>"
    + '<div class="statrow"><span class="k">Sound effects</span><button class="btn sm" data-action="sound-toggle">' + (typeof SOUND_ON !== "undefined" && SOUND_ON ? "On — tap to mute" : "Off — tap to enable") + "</button></div>"
    + '<div class="empty" style="padding:8px 0 0">v42.5 · autosaves locally after every week</div>'
    + "</div>";
  return html;
}

/* ── game over ────────────────────────────────────────────────── */
function vGameOver() {
  return '<div class="start"><div class="card" style="text-align:center">'
    + '<div style="font-size:34px">💀</div>'
    + '<h2 style="margin:8px 0">Bankrupt.</h2>'
    + '<div class="tagline" style="margin-bottom:14px">Creditors seized ' + esc(S.studio.name) + " after " + S.studio.year + " year(s). " + S.stats.hits + " hits, " + S.stats.flops + " flops, " + fm(S.studio.lifetime) + " lifetime gross.</div>"
    + "</div>"
    + (S.scenario && S.scenario.done ? '<div style="margin:8px 0"><span class="tag gold">🎯 Scenario achieved: ' + esc(S.scenario.n) + "</span></div>" : "")
    + (S.scenario && S.scenario.done ? '<div style="margin:8px 0"><span class="tag gold">🎯 Scenario achieved: ' + esc(S.scenario.n) + "</span></div>" : "")
    + '<button class="btn primary block" data-action="continue-dynasty">👑 Continue the dynasty</button>'
    + '<button class="btn block" data-action="new-game">' + t("Start over") + "</button>"
    + "</div></div>";
}

/* ── render ───────────────────────────────────────────────────── */
function render() {
  var inGame = S && VIEW !== "start" && VIEW !== "gameover";
  el("topbar").hidden = !inGame;
  el("tabbar").hidden = !inGame;
  if (inGame) {
    paintHud();
    var tabLabels = { studio: t("Studio"), develop: t("Develop"), playing: t("Playing"), ledger: t("Ledger"), more: t("More") };
    document.querySelectorAll("#tabbar .tab").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === VIEW);
      var sp = b.querySelector("span");
      if (sp) sp.textContent = tabLabels[b.getAttribute("data-view")] || sp.textContent;
    });
    var wbs = document.querySelector("#btnWeek span");
    if (wbs) wbs.textContent = t("Week");
    el("btnWeek").classList.toggle("attn", readyProjects().length > 0 || !!S.pending);
  }
  var v = el("view");
  v.scrollTop = 0;
  var html = "";
  if (VIEW === "start") html = vStart();
  else if (VIEW === "gameover") html = vGameOver();
  else if (VIEW === "studio") html = vStudio();
  else if (VIEW === "develop") html = vDevelop();
  else if (VIEW === "playing") html = vPlaying();
  else if (VIEW === "ledger") html = vLedger();
  else if (VIEW === "more") html = vMore();
  if (typeof tutorialBanner === "function" && VIEW !== "start" && VIEW !== "gameover") {
    var tb = tutorialBanner();
    if (tb) html = tb + html;
  }
  v.innerHTML = html;
}

/* ── sheets: greenlight ───────────────────────────────────────── */
function glTotals() {
  var idea = findIdea(GL.ideaId), sc = scaleOf(GL.scale);
  var budget = sc.budgets[GL.bIdx];
  var dir = findTalent(GL.dirId), act = findTalent(GL.actorId);
  var scriptCost = Math.round(idea.price * (S.origin === "indie" ? 0.75 : 1) * 10) / 10;
  var dirFee = dir ? feeFor(dir, budget) : 0, actFee = act ? feeFor(act, budget) : 0;
  var pkgCost = 0;
  if (GL.packaged && S.agency.founded) {
    dirFee = Math.round(dirFee * 0.75 * 10) / 10;
    actFee = Math.round(actFee * 0.75 * 10) / 10;
    pkgCost = Math.round(budget * 0.1 * 10) / 10;
  }
  var mkt = Math.round(budget * sc.mktRate * MKT_TIERS[GL.mktIdx].mult * 10) / 10;
  return { budget: budget, scriptCost: scriptCost, dirFee: dirFee, actFee: actFee, pkgCost: pkgCost, total: scriptCost + dirFee + actFee + budget + pkgCost, mkt: mkt };
}
function glProjection() {
  var idea = findIdea(GL.ideaId), sc = scaleOf(GL.scale), g = genreOf(idea.genre);
  var budget = sc.budgets[GL.bIdx];
  var dir = findTalent(GL.dirId), act = findTalent(GL.actorId);
  var starF = 1 + 0.09 * Math.min(act ? act.power : 2, 5.5);
  var recM = Math.max(budget * sc.mktRate, 0.8);
  var mktF = clamp(Math.pow(budget * sc.mktRate * MKT_TIERS[GL.mktIdx].mult / recM, 0.45), 0.5, 1.6);
  var repF = 0.92 + S.studio.rep / 600;
  var base = sc.openBase * g.mass * g.open * starF * mktF * repF * S.econ.box;
  var quality = Math.round(0.32 * (idea.script + (idea.franchiseOf ? 5 : 0) + (GL.packaged ? 4 : 0)) + 0.26 * ((dir ? dir.skill : 45) + (dir && dir.fit.indexOf(idea.genre) >= 0 ? 6 : 0)) + 0.24 * ((act ? act.skill : 45) + (act && act.fit.indexOf(idea.genre) >= 0 ? 6 : 0)) + 0.18 * (55 + S.upg.post * 3));
  return { open: base, quality: quality };
}
function personRow(kind, selectedId) {
  var out = '<div class="talent-row">';
  var list = S.market.filter(function (t) { return t.k === kind; }).sort(function (a, b) { return b.power - a.power || b.skill - a.skill; });
  list.forEach(function (t) {
    var busy = talentBusy(t);
    out += '<button class="person' + (t.id === selectedId ? " on" : "") + '" data-action="' + (kind === "dir" ? "gl-dir" : "gl-act") + '" data-id="' + t.id + '" ' + (busy ? "disabled" : "") + '>'
      + '<div class="nm">' + esc(t.n) + (busy ? " (booked)" : "") + "</div>"
      + '<div class="st">' + "★".repeat(t.power) + " · skill " + t.skill + (t.scouted ? ' <span class="fit">scouted</span>' : "") + (t.fit.indexOf(GL && GL._genre ? GL._genre : "action") >= 0 ? ' <span class="fit">genre fit</span>' : "") + "</div>"
      + '<div class="fee">' + fm(feeFor(t, scaleOf(GL.scale).budgets[GL.bIdx])) + "</div></button>";
  });
  return out + "</div>";
}
function sheetGreenlight(ideaId) {
  var idea = findIdea(ideaId);
  if (!idea) return;
  if (!GL || GL.ideaId !== ideaId) GL = { ideaId: ideaId, scale: "indie", bIdx: 1, dirId: null, actorId: null, mktIdx: 1, packaged: false, _genre: idea.genre };
  var g = genreOf(idea.genre);
  var html = '<div class="sheet-head"><h3>' + g.em + " " + esc(idea.title) + "</h3>"
    + '<button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">';
  html += '<div>' + tag(g.name) + tag("Script ✦ " + idea.script, idea.script >= 75 ? "green" : "") + (idea.theme ? tag("✦ " + esc(themeName(idea.theme))) : "") + (idea.franchiseOf ? tag("Sequel to “" + esc(idea.franchiseOf) + "”", "blue") : "") + "</div>";

  html += '<div class="field-label">Scale</div><div class="seg" style="flex-wrap:wrap">';
  SCALES.forEach(function (sc) {
    var ok = scaleAllowed(sc);
    html += '<button class="' + (GL.scale === sc.id ? "on" : "") + '" data-action="gl-scale" data-scale="' + sc.id + '" ' + (ok ? "" : "disabled") + ">" + sc.name + (ok ? "" : " 🔒" + sc.rep) + "</button>";
  });
  html += "</div>";

  html += '<div class="field-label">Budget</div><div class="seg">';
  scaleOf(GL.scale).budgets.forEach(function (b, i) {
    html += '<button class="' + (GL.bIdx === i ? "on" : "") + '" data-action="gl-budget" data-idx="' + i + '">' + fm(b) + "</button>";
  });
  html += "</div>";

  html += '<div class="field-label">Director</div>' + personRow("dir", GL.dirId);
  html += '<div class="field-label">Lead actor</div>' + personRow("actor", GL.actorId);

  html += '<div class="field-label">Marketing plan (paid when you schedule the release)</div><div class="seg" style="flex-wrap:wrap">';
  MKT_TIERS.forEach(function (m, i) {
    var cost = Math.round(scaleOf(GL.scale).budgets[GL.bIdx] * scaleOf(GL.scale).mktRate * m.mult * 10) / 10;
    html += '<button class="' + (GL.mktIdx === i ? "on" : "") + '" data-action="gl-mkt" data-idx="' + i + '">' + m.name + " · " + fm(cost) + "</button>";
  });
  html += "</div>";
  if (S.agency.founded) {
    var pkgCost = Math.round(scaleOf(GL.scale).budgets[GL.bIdx] * 0.1 * 10) / 10;
    html += '<div class="field-label">Elite agency package — script +4, talent fees −25%</div><div class="seg">'
      + '<button class="' + (GL.packaged ? "on" : "") + '" data-action="gl-package">' + (GL.packaged ? "Packaged · " + fm(pkgCost) : "Add package · " + fm(pkgCost)) + "</button></div>";
  }
  html += "</div>";

  var T = glTotals(), P = glProjection();
  var canHire = GL.dirId && GL.actorId;
  html += '<div class="sheet-foot"><div class="proj">Opening estimate <b>' + fm(P.open * 0.75) + "–" + fm(P.open * 1.3) + "</b> · quality ≈ <b>" + P.quality + "</b>"
    + "<br>Total now <b>" + fm(T.total) + "</b> · marketing " + fm(T.mkt) + " later · cash after <b>" + fm(S.studio.cash - T.total) + "</b></div>"
    + '<button class="btn primary" data-action="gl-confirm" ' + (canHire && S.studio.cash >= T.total ? "" : "disabled") + ">Greenlight</button></div>";
  openSheet(html);
}

/* ── sheets: release ──────────────────────────────────────────── */
function previewOpening(p, weekAbs, mktIdx) {
  var sc = scaleOf(p.scale);
  var mkt = Math.round(p.budget * sc.mktRate * MKT_TIERS[mktIdx].mult * 10) / 10;
  var probe = { genre: p.genre, scale: p.scale, budget: p.budget, actId: p.actId, scandal: p.scandal, buzz: p.buzz, franchiseOf: p.franchiseOf, mkt: mkt, releaseWeek: weekAbs };
  return expectedOpening(probe);
}
function sheetRelease(pId) {
  var p = findProject(pId);
  if (!p) return;
  if (!RL || RL.pId !== pId) RL = { pId: pId, week: S.studio.week + 1, mktIdx: p.mktIdx != null ? p.mktIdx : 1, window: p.window || 45 };
  var g = genreOf(p.genre);
  var html = '<div class="sheet-head"><h3>Release · ' + g.em + " " + esc(p.title) + "</h3>"
    + '<button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">';
  html += "<div>" + tag(g.name) + tag(fm(p.budgetNow) + " budget") + (p.qPreview ? tag("Internal screening " + p.qPreview, "blue") : "") + "</div>";
  html += '<div class="field-label">Release week</div><div class="seg" style="flex-wrap:wrap">';
  var i;
  for (i = 1; i <= 8; i++) {
    var wk = S.studio.week + i;
    var rw = rivalWeightAt(wk);
    var season = seasonOf(woyOf(wk));
    var sev = clashSeverity(wk, Math.max(scaleOf(p.scale).openBase * genreOf(p.genre).mass, 1));
    html += '<button class="' + (RL.week === wk ? "on" : "") + '" data-action="rl-week" data-week="' + wk + '">+' + i + "·" + (season.hol ? "🎄" : season.s >= 1.2 ? "☀️" : season.scare ? "🎃" : "·") + (rw > 25 ? "⚠️" : "") + (sev === "CRITICAL" ? "‼️" : "") + "</button>";
  }
  html += "</div><div class='empty' style='padding:2px 0 0'>⚠️ = a rival opens a big film that week · ☀️ summer · 🎄 holiday · 🎃 horror corridor</div>";
  html += '<div class="field-label">Theatrical window</div><div class="seg" style="flex-wrap:wrap">';
  [[17, "17-day · early OTT"], [45, "45-day · standard"], [90, "90-day · exclusive"]].forEach(function (wd) {
    html += '<button class="' + (RL.window === wd[0] ? "on" : "") + '" data-action="rl-window" data-window="' + wd[0] + '">' + wd[1] + "</button>";
  });
  html += "</div><div class='empty' style='padding:2px 0 0'>Short windows anger exhibitors but pull streaming offers +40% · long windows please them and cut OTT offers 20%</div>";

  html += '<div class="field-label">Marketing campaign</div><div class="seg" style="flex-wrap:wrap">';
  MKT_TIERS.forEach(function (m, idx) {
    var cost = Math.round(p.budget * scaleOf(p.scale).mktRate * m.mult * 10) / 10;
    html += '<button class="' + (RL.mktIdx === idx ? "on" : "") + '" data-action="rl-mkt" data-idx="' + idx + '">' + m.name + " · " + fm(cost) + "</button>";
  });
  html += "</div></div>";
  var mkt = Math.round(p.budget * scaleOf(p.scale).mktRate * MKT_TIERS[RL.mktIdx].mult * 10) / 10;
  var open = previewOpening(p, RL.week, RL.mktIdx);
  html += '<div class="sheet-foot"><div class="proj">Projected opening <b>' + fm(open * 0.8) + "–" + fm(open * 1.2) + "</b> · campaign <b>" + fm(mkt) + "</b> · cash after <b>" + fm(S.studio.cash - mkt) + "</b></div>"
    + '<button class="btn primary" data-action="rl-confirm" ' + (S.studio.cash >= mkt ? "" : "disabled") + ">Schedule</button></div>";
  openSheet(html);
}

/* ── sheets: film detail ──────────────────────────────────────── */
function sheetFilm(fId) {
  var f = findFilm(fId);
  if (!f) return;
  var g = genreOf(f.genre);
  var html = '<div class="sheet-head"><h3>' + g.em + " " + esc(f.title) + "</h3>"
    + '<button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">';
  html += "<div>" + tag(g.name) + tag(f.status === "run" ? "In theaters" : "Run ended", f.status === "run" ? "blue" : "") + (f.franchiseOf ? tag("Sequel", "blue") : "") + "</div>";
  var share2 = clamp(g.intl + (typeof bizIntlBonus === "function" ? bizIntlBonus() : 0), 0.1, 0.8);
  var wwEst = f.ww != null ? f.ww : Math.round(f.dom * (1 + share2) / (1 - share2) * 10) / 10;
  var roi = f.cost > 0 ? (f.profit != null ? f.profit / f.cost : (f.dom * 0.52 - f.cost) / f.cost) : 0;
  html += '<div class="card">'
    + statrow("Production budget", fm(f.budget))
    + statrow("Marketing spend", fm(f.mkt))
    + statrow("Total cost", fm(f.cost))
    + statrow("Opening weekend", fm(f.opening))
    + statrow("Domestic " + (f.ww != null ? "final" : "so far"), fm(f.dom))
    + statrow("International " + (f.ww != null ? "final" : "est · " + Math.round(share2 * 100) + "% share"), f.intl != null ? fm(f.intl) : fm(Math.max(0, wwEst - f.dom)))
    + statrow("Worldwide " + (f.ww != null ? "final" : "est"), fm(wwEst), f.ww != null && f.ww >= f.cost ? "up" : "")
    + (f.profit != null ? statrow("Net result · " + Math.round(roi * 100) + "% ROI", (f.profit >= 0 ? "+" : "") + fm(f.profit), f.profit >= 0 ? "up" : "down") : statrow("Theatrical rentals so far", fm(f.dom * 0.52)))
    + statrow("Quality / legs", f.quality + " · " + f.legs.toFixed(2))
    + statrow("Released", "Y" + S.studio.year + " · " + f.season)
    + "</div>";
  if (f.criticAvg != null) {
    html += '<div class="sechead"><h2>Reviews</h2></div><div class="card">'
      + statrow("Critics", f.criticAvg + "% fresh · " + f.freshPct + "%", f.criticAvg >= 60 ? "up" : "down")
      + statrow("Audience score", f.aud + "/100", f.aud >= 60 ? "up" : "down") + "</div>";
    f.quotes.slice(0, 3).forEach(function (q) {
      html += '<div class="news-item"><span class="ico">🎙️</span><div>“' + esc(q.q) + '”<div class="when">' + esc(q.n) + " · " + q.score + "/100</div></div></div>";
    });
  }
  if (typeof filmTerritoryRows === "function") {
    html += '<div class="sechead"><h2>Where it earned</h2></div><div class="card">' + filmTerritoryRows(f) + "</div>";
  }
  if (f.weekly.length) {
    var wks = f.weekly.slice(-12);
    var maxW = 1;
    wks.forEach(function (wv) { maxW = Math.max(maxW, wv); });
    html += '<div class="sechead"><h2>Weekly grosses</h2></div><div class="card"><div class="chart">';
    wks.forEach(function (wv, wi) {
      var pct = Math.max(4, Math.round(wv / maxW * 100));
      html += '<div class="c me"><i style="height:' + pct + '%"></i><span>W' + (f.weekly.length - wks.length + wi + 1) + "</span></div>";
    });
    html += '</div><div class="empty" style="padding:4px 0 0">Week by week · latest weekend ' + fm(wks[wks.length - 1]) + "</div></div>";
  }
  openSheet(html);
}

/* ── sheets: generic ──────────────────────────────────────────── */
function sheetConfirm(txt, yesLabel, yesFn) {
  CONFIRM = { fn: yesFn };
  openSheet('<div class="sheet-head"><h3>Are you sure?</h3><button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div>'
    + '<div class="sheet-body"><div class="card">' + txt + "</div></div>"
    + '<div class="sheet-foot"><button class="btn sm" data-action="sheet-close">Cancel</button>'
    + '<button class="btn danger grow" data-action="confirm-yes">' + yesLabel + "</button></div>");
}
function sheetExport() {
  var raw = "";
  try { raw = localStorage.getItem(SAVE_KEY) || ""; } catch (e) {}
  var h = '<div class="sheet-head"><h3>Save & load</h3><button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div>';
  h += '<div class="sheet-body"><div class="field-label">Export — copy this text somewhere safe</div>';
  h += '<textarea class="text-input" id="saveBox" rows="6" style="font-size:12px;word-break:break-all">' + esc(raw) + "</textarea>";
  h += '<button class="btn block" data-action="copy-save">Copy to clipboard</button>';
  h += '<div class="field-label" style="margin-top:14px">Import — paste a save and press</div>';
  h += '<textarea class="text-input" id="importBox" rows="4" style="font-size:12px;word-break:break-all" placeholder="paste exported save text"></textarea>';
  h += '<button class="btn block" data-action="import-save">Import save</button></div>';
  openSheet(h);
}
function sheetIncident(pd) {
  var h = '<div class="sheet-head"><h3>' + (pd.kind === "cyber" ? "🔐 Cyberattack" : pd.kind === "leak" ? "📁 Script leak" : "🪧 Crew dispute") + "</h3></div>";
  h += '<div class="sheet-body">';
  if (pd.kind === "cyber") {
    h += '<div class="card">Hackers breached the press servers and hold embargoed materials.</div>'
      + '<div class="card">'
      + statrow("Contain — lawyers, security, silence", '<button class="btn sm" data-action="incident-opt" data-idx="0" ' + (S.studio.cash >= 7 ? "" : "disabled") + ">$7M</button>")
      + statrow("Disclose responsibly", '<button class="btn sm" data-action="incident-opt" data-idx="1" ' + (S.studio.cash >= 3 ? "" : "disabled") + ">$3M · rep −1</button>")
      + statrow("Conceal it and hope", '<button class="btn sm" data-action="incident-opt" data-idx="2">Free · rep −4, +$6M debt</button>')
      + "</div>";
  } else if (pd.kind === "leak") {
    var lp = findProject(pd.projectId);
    h += '<div class="card">A workprint of “' + esc(lp ? lp.title : "an upcoming film") + '" is online. Respond:</div>'
      + '<div class="card">'
      + statrow("Contain with takedowns", '<button class="btn sm" data-action="incident-opt" data-idx="0" ' + (S.studio.cash >= 5 ? "" : "disabled") + ">$5M</button>")
      + statrow("Own the leak — lean into the buzz", '<button class="btn sm" data-action="incident-opt" data-idx="1">Buzz +3 · quality −4</button>')
      + statrow("Ignore it", '<button class="btn sm" data-action="incident-opt" data-idx="2">40% chance quality −6</button>')
      + "</div>";
  } else {
    h += '<div class="card">A crew dispute over hours is escalating into a walkout threat.</div>'
      + '<div class="card">'
      + statrow("Settle with a package", '<button class="btn sm" data-action="incident-opt" data-idx="0" ' + (S.studio.cash >= 5 ? "" : "disabled") + ">$5M</button>")
      + statrow("Mediate — pause the shoot a week", '<button class="btn sm" data-action="incident-opt" data-idx="1">1 wk delay</button>')
      + statrow("Refuse — 30% chance of a strike", '<button class="btn sm" data-action="incident-opt" data-idx="2">Risk strike 4 wks</button>')
      + "</div>";
  }
  h += "</div>";
  openSheet(h);
}

function openPendingSheet() {
  var p = S.pending;
  if (p.type === "poach") return sheetPoach(p);
  if (p.type === "incident") return sheetIncident(p);
  if (p.type === "scandal") return sheetScandal(p);
  /* generic choice sheet: pending.title + pending.text + pending.options[{label, note}] */
  if (p.options && p.options.length) {
    var h = '<div class="sheet-head"><h3>' + esc(p.title || "Studio event") + "</h3></div><div class=\"sheet-body\">";
    if (p.text) h += '<div class="card">' + esc(p.text) + "</div>";
    h += "<div class='card'>";
    p.options.forEach(function (o, i) {
      h += '<div class="statrow"><span class="k">' + esc(o.label) + (o.note ? '<br><small style="color:var(--faint)">' + esc(o.note) + "</small>" : "") + "</span>";
      h += '<button class="btn sm" data-action="pending-opt" data-idx="' + i + '" ' + (o.cost && S.studio.cash < o.cost ? "disabled" : "") + ">" + (o.cost ? fm(o.cost) : "Free") + "</button></div>";
    });
    h += "</div></div>";
    return openSheet(h);
  }
  sheetScandal(p);
}

function sheetHeirs() {
  var HEIRS = [
    { id: "auteur", n: "The Auteur", d: "+2 quality on every film · directors cost 20% less" },
    { id: "wall", n: "The Wall Street heir", d: "Trust fund +25%" },
    { id: "royalty", n: "Hollywood royalty", d: "Reputation +20 the day the will is read" },
    { id: "digital", n: "The digital native", d: "Inherited streaming library — $150M catalog from day one" }
  ];
  var h = '<div class="sheet-head"><h3>👑 Choose the heir</h3></div><div class="sheet-body">';
  h += '<div class="origin">';
  HEIRS.forEach(function (o) {
    h += '<button data-action="heir-pick" data-heir="' + o.id + '"><div class="nm">' + o.n + '</div><div class="ds">' + o.d + "</div></button>";
  });
  h += "</div></div>";
  openSheet(h);
}

function sheetPoach(pd) {
  var t = findTalent(pd.tid);
  if (!t) { S.pending = null; return; }
  var h = '<div class="sheet-head"><h3>🕵️ Poaching attempt</h3></div>';
  h += '<div class="sheet-body"><div class="card"><b>' + esc(t.n) + "</b> (" + "★".repeat(t.power);
  if (abilityOf(t)) h += " · " + esc(abilityOf(t).n);
  h += ') is being courted by ' + esc(pd.rival) + '. Retain them with a raise, or lose them from the market.</div></div>';
  h += '<div class="sheet-foot"><button class="btn sm" data-action="poach-lose">Let them go</button>';
  h += '<button class="btn primary grow" data-action="poach-keep" ' + (S.studio.cash >= pd.fee ? "" : "disabled") + ">Retain · " + fm(pd.fee) + "</button></div>";
  openSheet(h);
}

function sheetScandal(pd) {
  openSheet('<div class="sheet-head"><h3>🚨 PR crisis</h3></div>'
    + '<div class="sheet-body"><div class="card">Tabloids are running a story on the lead of “' + esc(pd.title) + '”. Its opening is projected <b>-12%</b> unless you kill the story.</div></div>'
    + '<div class="sheet-foot"><button class="btn sm" data-action="event-ignore">Let it ride</button>'
    + '<button class="btn primary grow" data-action="event-pay" ' + (S.studio.cash >= pd.fee ? "" : "disabled") + ">Kill the story · $" + pd.fee + "M</button></div>");
}

/* ── actions ──────────────────────────────────────────────────── */
function onAction(a, elx) {
  if (S) {
  if (typeof tvAction === "function" && tvAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof empireAction === "function" && empireAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof prAction === "function" && prAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof bizAction === "function" && bizAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof ottAction === "function" && ottAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof gamesAction === "function" && gamesAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof libAction === "function" && libAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof exhibitionAction === "function" && exhibitionAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof creativeAction === "function" && creativeAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof financeAction === "function" && financeAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof challengeAction === "function" && challengeAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof posterAction === "function" && posterAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof peopleAction === "function" && peopleAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof mediaAction === "function" && mediaAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof strategyAction === "function" && strategyAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof metaAction === "function" && metaAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof techAction === "function" && techAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof events2Action === "function" && events2Action(a, elx)) { refreshDeskSheet(); return; }
  if (typeof bizdealAction === "function" && bizdealAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof slotsAction === "function" && slotsAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof meta2Action === "function" && meta2Action(a, elx)) { refreshDeskSheet(); return; }
  if (typeof crewAction === "function" && crewAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof masteryAction === "function" && masteryAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof worldAction === "function" && worldAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof licensingAction === "function" && licensingAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof awardsAction === "function" && awardsAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof festivalAction === "function" && festivalAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof socialAction === "function" && socialAction(a, elx)) { refreshDeskSheet(); return; }
  if (typeof stadAction === "function" && stadAction(a, elx)) { refreshDeskSheet(); return; }
  }
  var id = elx.getAttribute("data-id");
  switch (a) {
    case "nav": VIEW = elx.getAttribute("data-view"); render(); break;
    case "resume": VIEW = "studio"; render(); break;
    case "pick-origin": selOrigin = elx.getAttribute("data-origin"); render(); break;
    case "pick-diff": selDiff = elx.getAttribute("data-diff"); render(); break;
    case "pick-scenario": selScenario = elx.getAttribute("data-scenario"); render(); break;
    case "start-game": {
      var nm = (el("studioName") && el("studioName").value || "").trim() || "Lighthouse Pictures";
      newGame(nm, selOrigin, selDiff, selScenario);
      VIEW = "studio";
      render(); drainFlash();
      break;
    }
    case "dev-tab": DEV_TAB = elx.getAttribute("data-tab"); render(); break;
    case "scout": scoutScripts(); render(); break;
    case "gl-open": sheetGreenlight(id); break;
    case "gl-scale": GL.scale = elx.getAttribute("data-scale"); sheetGreenlight(GL.ideaId); break;
    case "gl-budget": GL.bIdx = +elx.getAttribute("data-idx"); sheetGreenlight(GL.ideaId); break;
    case "gl-dir": GL.dirId = id; sheetGreenlight(GL.ideaId); break;
    case "gl-act": GL.actorId = id; sheetGreenlight(GL.ideaId); break;
    case "gl-mkt": GL.mktIdx = +elx.getAttribute("data-idx"); sheetGreenlight(GL.ideaId); break;
    case "gl-package": GL.packaged = !GL.packaged; sheetGreenlight(GL.ideaId); break;
    case "gl-confirm": {
      var r = greenlight(GL.ideaId, { scale: GL.scale, bIdx: GL.bIdx, dirId: GL.dirId, actorId: GL.actorId, mktIdx: GL.mktIdx, packaged: GL.packaged && !!S.agency.founded });
      if (r.err) { pushToast(r.err, "bad"); break; }
      closeSheet(); DEV_TAB = "slate"; render(); drainFlash();
      break;
    }
    case "rl-open": sheetRelease(id); break;
    case "rl-week": RL.week = +elx.getAttribute("data-week"); sheetRelease(RL.pId); break;
    case "rl-window": RL.window = +elx.getAttribute("data-window"); sheetRelease(RL.pId); break;
    case "rl-mkt": RL.mktIdx = +elx.getAttribute("data-idx"); sheetRelease(RL.pId); break;
    case "rl-confirm": {
      var p = findProject(RL.pId);
      var rr = setRelease(p, RL.week, RL.mktIdx, RL.window);
      if (rr.err) { pushToast(rr.err, "bad"); break; }
      closeSheet(); render(); drainFlash();
      break;
    }
    case "film-open": sheetFilm(id); break;
    case "desk-open": {
      var d = findDesk(id);
      if (d) {
        LAST_DESK = d;
        openSheet('<div class="sheet-head"><h3>' + d.icon + " " + esc(d.name) + '</h3><button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div>'
          + '<div class="sheet-body">' + d.render() + "</div>");
      }
      break;
    }
    case "ag-found": if (foundAgency()) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "ag-sign": if (signClient(id)) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "ag-drop": if (dropClient(id)) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "lot-hire": if (hireLotStaff(elx.getAttribute("data-key"))) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "lot-fire": if (fireLotStaff(elx.getAttribute("data-key"))) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "poach-keep": {
      var pdk = S.pending;
      if (pdk && S.studio.cash >= pdk.fee) {
        var tk = findTalent(pdk.tid);
        spend(pdk.fee, "Retain " + (tk ? tk.n : "talent"));
        S.pending = null; closeSheet();
        pushToast("They stay. For a price.", "good");
        render();
      }
      break;
    }
    case "poach-lose": {
      var pdl = S.pending;
      if (pdl) {
        var tl = findTalent(pdl.tid);
        if (tl) {
          var ix2 = S.market.indexOf(tl);
          if (ix2 >= 0) S.market.splice(ix2, 1);
          log(tl.n + " departs for " + pdl.rival + ". The trade papers call it a coup.", "bad", "🕵️");
        }
        S.pending = null; closeSheet();
        pushToast("They're gone.", "bad");
        render();
      }
      break;
    }
    case "upgrade": if (buyUpgrade(elx.getAttribute("data-key"))) { render(); drainFlash(); } break;
    case "loan": if (takeLoan()) { render(); drainFlash(); } break;
    case "repay": if (repayLoan()) { render(); drainFlash(); } break;
    case "export-save": sheetExport(); break;
    case "copy-save": {
      var box = el("saveBox");
      if (box) {
        box.select();
        try { if (navigator.clipboard) navigator.clipboard.writeText(box.value); else document.execCommand("copy"); pushToast("Save copied to clipboard.", "good"); } catch (e) {}
      }
      break;
    }
    case "new-game": sheetConfirm("This erases your current studio and starts fresh.", "Start over", function () { VIEW = "start"; S = null; wipeSave(); render(); }); break;
    case "confirm-yes": if (CONFIRM && CONFIRM.fn) { var fn = CONFIRM.fn; closeSheet(); fn(); } break;
    case "proj-clear": if (clearTitles(id)) { saveGame(); render(); drainFlash(); } break;
    case "proj-recut": if (recutFilm(id)) { saveGame(); render(); drainFlash(); } break;
    case "mezz-draw": if (drawMezz()) { saveGame(); render(); drainFlash(); } break;
    case "mezz-repay": if (repayMezz()) { saveGame(); render(); drainFlash(); } break;
    case "ag-upgrade": if (upgradeDeal(id)) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "event-deny": {
      var pdd = S.pending;
      if (pdd) {
        var prd = findProject(pdd.projectId);
        if (prd && chance(0.5)) { prd.scandal = false; log("The studio denies everything — and the story dies.", "good", "🎭"); pushToast("The denial holds. Story dies.", "good"); }
        else { if (prd) prd.buzz = Math.max(0, (prd.buzz || 0) - 2); log("The denial backfired — the story grew legs.", "bad", "🎭"); pushToast("The denial backfired. Worse press.", "bad"); }
        S.pending = null; closeSheet(); render();
      }
      break;
    }
    case "event-apologize": {
      var pda = S.pending;
      if (pda && S.studio.cash >= 1) {
        spend(1, "Crisis PR · apology tour");
        var pra = findProject(pda.projectId);
        if (pra) { pra.scandal = false; pra.buzz = Math.max(0, (pra.buzz || 0) - 2); }
        S.pending = null; closeSheet(); pushToast("Apology accepted. Buzz cooled a little.", ""); render();
      }
      break;
    }
    case "event-warroom": {
      var pdw = S.pending;
      if (pdw && S.studio.cash >= 8) {
        spend(8, "Crisis PR · war room");
        var prw = findProject(pdw.projectId);
        if (prw) prw.scandal = false;
        S.studio.rep = clamp(S.studio.rep + 1, 0, 100);
        S.pending = null; closeSheet(); pushToast("War room wins the news cycle. Rep +1.", "good"); render();
      }
      break;
    }
    case "continue-dynasty": sheetHeirs(); break;
    case "set-pref": setPref(elx.getAttribute("data-key"), elx.getAttribute("data-val")); render(); break;
    case "sound-toggle": setSound(!SOUND_ON); pushToast(SOUND_ON ? "Sound on." : "Sound off.", ""); render(); break;
    case "pwa-install": {
      if (window.__deferredPrompt) { window.__deferredPrompt.prompt(); window.__deferredPrompt = null; }
      break;
    }
    case "import-save": {
      var box2 = el("importBox");
      if (box2 && box2.value.trim()) {
        try {
          var parsed = JSON.parse(box2.value.trim());
          if (parsed && parsed.v === 1 && parsed.studio && parsed.studio.name) {
            S = parsed;
            saveGame();
            closeSheet();
            VIEW = S.over ? "gameover" : "studio";
            lastCash = null;
            render();
            pushToast("Save imported — welcome back, " + S.studio.name + ".", "good");
          } else pushToast("That text isn't a valid save.", "bad");
        } catch (e) { pushToast("Could not parse that save.", "bad"); }
      }
      break;
    }
    case "proj-clear": if (clearTitles(id)) { saveGame(); render(); drainFlash(); } break;
    case "proj-recut": if (recutFilm(id)) { saveGame(); render(); drainFlash(); } break;
    case "mezz-draw": if (drawMezz()) { saveGame(); render(); drainFlash(); } break;
    case "mezz-repay": if (repayMezz()) { saveGame(); render(); drainFlash(); } break;
    case "ag-upgrade": if (upgradeDeal(id)) { saveGame(); render(); refreshDeskSheet(); drainFlash(); } break;
    case "event-deny": {
      var pdd = S.pending;
      if (pdd) {
        var prd = findProject(pdd.projectId);
        if (prd && chance(0.5)) { prd.scandal = false; log("The studio denies everything — and the story dies.", "good", "🎭"); pushToast("The denial holds. Story dies.", "good"); }
        else { if (prd) prd.buzz = Math.max(0, (prd.buzz || 0) - 2); log("The denial backfired — the story grew legs.", "bad", "🎭"); pushToast("The denial backfired. Worse press.", "bad"); }
        S.pending = null; closeSheet(); render();
      }
      break;
    }
    case "event-apologize": {
      var pda = S.pending;
      if (pda && S.studio.cash >= 1) {
        spend(1, "Crisis PR · apology tour");
        var pra = findProject(pda.projectId);
        if (pra) { pra.scandal = false; pra.buzz = Math.max(0, (pra.buzz || 0) - 2); }
        S.pending = null; closeSheet(); pushToast("Apology accepted. Buzz cooled a little.", ""); render();
      }
      break;
    }
    case "event-warroom": {
      var pdw = S.pending;
      if (pdw && S.studio.cash >= 8) {
        spend(8, "Crisis PR · war room");
        var prw = findProject(pdw.projectId);
        if (prw) prw.scandal = false;
        S.studio.rep = clamp(S.studio.rep + 1, 0, 100);
        S.pending = null; closeSheet(); pushToast("War room wins the news cycle. Rep +1.", "good"); render();
      }
      break;
    }
    case "heir-pick": {
      var heir = elx.getAttribute("data-heir");
      if (S && !S.over) {
        var rr3 = retire(heir);
        if (rr3.err) { pushToast(rr3.err, "bad"); break; }
      }
      var lg2 = null;
      try { lg2 = JSON.parse(localStorage.getItem("bow2.legacy.v1") || "null"); } catch (e) {}
      if (lg2) { lg2.carry = lg2.carry || {}; lg2.carry.heir = heir; try { localStorage.setItem("bow2.legacy.v1", JSON.stringify(lg2)); } catch (e) {} }
      closeSheet();
      newGame((lg2 && lg2.name ? lg2.name : "Studio") + " II", "veteran", "std", "free");
      VIEW = "studio";
      lastCash = null;
      render();
      drainFlash();
      break;
    }
    case "retire-open": sheetHeirs(); break;
    case "incident-opt": {
      var idx = +elx.getAttribute("data-idx");
      var inc = S.pending;
      if (!inc || inc.type !== "incident") break;
      if (inc.kind === "cyber") {
        if (idx === 0 && S.studio.cash >= 7) { spend(7, "Incident containment"); log("The breach is contained. Nothing leaks.", "good", "🔐"); }
        else if (idx === 1 && S.studio.cash >= 3) { spend(3, "Responsible disclosure"); S.studio.rep = clamp(S.studio.rep - 1, 0, 100); log("Disclosed responsibly — a small reputational bruise.", "", "🔐"); }
        else { S.studio.rep = clamp(S.studio.rep - 4, 0, 100); S.loans.push({ amt: 6, rate: 0.008 }); log("The concealment unravels: rep −4 and $6M in hush-debt.", "bad", "🔐"); }
      } else if (inc.kind === "leak") {
        var lp2 = findProject(inc.projectId);
        if (idx === 0 && S.studio.cash >= 5) { spend(5, "Leak takedowns"); log("Takedowns scrub the workprint. Move along.", "good", "📁"); }
        else if (idx === 1) { if (lp2) { lp2.buzz += 3; lp2.leaked = true; } log("You own the leak — the internet is hyped, the cut is rough.", "", "📁"); }
        else if (chance(0.4)) { if (lp2) lp2.leakQ = true; log("The leak aged badly — viewers saw everything too soon.", "bad", "📁"); }
        else log("Nobody important watched the workprint.", "", "📁");
      } else {
        var dp = null;
        for (var di = 0; di < S.projects.length; di++) if (S.projects[di].phase === "shoot") dp = S.projects[di];
        if (idx === 0 && S.studio.cash >= 5) { spend(5, "Dispute settlement"); log("The dispute settles with a better package. Shoots resume.", "good", "🪧"); }
        else if (idx === 1) { if (dp) dp.delayWk = (dp.delayWk || 0) + 1; log("A mediator buys a week of calm.", "", "🪧"); }
        else if (chance(0.3)) { S.strike = 4; log("They walked. A 4-week strike begins.", "bad", "🪧"); }
        else log("The bluff works — nobody walks.", "good", "🪧");
      }
      S.pending = null;
      closeSheet();
      render();
      break;
    }
    case "pending-opt": {
      var handled = false;
      if (typeof tvAction === "function") handled = tvAction(a, elx);
      if (!handled && typeof empireAction === "function") handled = empireAction(a, elx);
      if (!handled && typeof prAction === "function") handled = prAction(a, elx);
      if (!handled && typeof bizAction === "function") handled = bizAction(a, elx);
      if (!handled && typeof ottAction === "function") handled = ottAction(a, elx);
      if (!handled && typeof gamesAction === "function") handled = gamesAction(a, elx);
      if (!handled && typeof exhibitionAction === "function") handled = exhibitionAction(a, elx);
      if (!handled && typeof creativeAction === "function") handled = creativeAction(a, elx);
      if (!handled && typeof strategyAction === "function") handled = strategyAction(a, elx);
      if (!handled && typeof metaAction === "function") handled = metaAction(a, elx);
      if (!handled && typeof peopleAction === "function") handled = peopleAction(a, elx);
      if (!handled && typeof mediaAction === "function") handled = mediaAction(a, elx);
      if (!handled && typeof techAction === "function") handled = techAction(a, elx);
      if (!handled && typeof events2Action === "function") handled = events2Action(a, elx);
      if (!handled && typeof bizdealAction === "function") handled = bizdealAction(a, elx);
      if (!handled && typeof meta2Action === "function") handled = meta2Action(a, elx);
      if (!handled && typeof crewAction === "function") handled = crewAction(a, elx);
      if (!handled && typeof masteryAction === "function") handled = masteryAction(a, elx);
      if (!handled && typeof worldAction === "function") handled = worldAction(a, elx);
      if (!handled && typeof licensingAction === "function") handled = licensingAction(a, elx);
      if (!handled && typeof awardsAction === "function") handled = awardsAction(a, elx);
      if (!handled && typeof festivalAction === "function") handled = festivalAction(a, elx);
      if (!handled && typeof socialAction === "function") handled = socialAction(a, elx);
      if (!handled && typeof stadAction === "function") handled = stadAction(a, elx);
      if (!handled) { S.pending = null; closeSheet(); render(); }
      break;
    }
    case "event-pay": {
      var pd = S.pending;
      if (pd && S.studio.cash >= pd.fee) {
        spend(pd.fee, "Crisis PR");
        var pr = findProject(pd.projectId);
        if (pr) {
          pr.scandal = false;
          log("Crisis PR buried the story. “" + pr.title + "” opens clean.", "good", "🧯");
        }
        S.pending = null;
        closeSheet();
        pushToast(pr ? "Story killed. Clean opening ahead." : "The story died on its own.", "good");
        render();
      }
      break;
    }
    case "event-ignore": {
      S.pending = null;
      closeSheet();
      pushToast("The story runs. Opening will take a hit.", "bad");
      break;
    }
    case "se-genre": SE_UI.genre = elx.getAttribute("data-genre"); render(); break;
    case "se-budget": SE_UI.bIdx = +elx.getAttribute("data-idx"); render(); break;
    case "se-go": {
      var sr = greenlightSeries(SE_UI.genre, SE_UI.bIdx);
      if (sr.err) pushToast(sr.err, "bad");
      saveGame(); render(); drainFlash();
      break;
    }
    case "se-sell": {
      var ss = sellSeriesOtt(id);
      if (ss.err) pushToast(ss.err, "bad");
      saveGame(); render(); drainFlash();
      break;
    }
    case "se-stream": {
      var stx = releaseSeriesStreamer(id);
      if (stx.err) pushToast(stx.err, "bad");
      saveGame(); render(); drainFlash();
      break;
    }
    case "pitch-open": sheetPitch(); break;
    case "pitch-genre": PITCH.genre = elx.getAttribute("data-genre"); sheetPitch(); break;
    case "pitch-theme": PITCH.theme = elx.getAttribute("data-theme") || null; sheetPitch(); break;
    case "pitch-go": {
      var prp = pitchIdea(PITCH.genre, PITCH.theme, el("pitchTitle") ? el("pitchTitle").value.trim() : "");
      if (prp.err) { pushToast(prp.err, "bad"); break; }
      closeSheet(); render(); drainFlash();
      break;
    }
    case "sheet-close": closeSheet(); break;
  }
}

function onAdvance() {
  if (!S || VIEW === "start" || VIEW === "gameover") return;
  if (S.pending) { openPendingSheet(); return; }
  var flash = advanceWeek();
  if (flash) flash.forEach(function (t) { pushToast(t.txt, t.kind); });
  if (S.over) { VIEW = "gameover"; render(); return; }
  render();
  if (S.pending) openPendingSheet();
}

function wire() {
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!t) return;
    if (t.disabled) return;
    e.preventDefault();
    onAction(t.getAttribute("data-action"), t);
  });
  el("btnWeek").addEventListener("click", onAdvance);
}

/* ── More: feature desks ─────────────────────────────────────── */
function abilityOf(t) {
  if (!t || !t.ability) return null;
  for (var i = 0; i < ABILITIES.length; i++) if (ABILITIES[i].id === t.ability) return ABILITIES[i];
  return null;
}
var MORE_LOCAL = [
  { id: "talent-agency", group: "Talent", icon: "🤝", name: "Talent agency", desc: "In-house agency: sign stars, earn weekly commissions, cut their fees, block poaching.", render: function () { return vAgencyDesk(); } },
  { id: "lot-staff", group: "The lot", icon: "🎬", name: "Lot & staff", desc: "Writers room, production crew and VFX unit — permanent quality on every film.", render: function () { return vLotDesk(); } }
];
function collectDesks() {
  var all = [];
  if (typeof TV_DESKS !== "undefined") all = all.concat(TV_DESKS);
  if (typeof EMPIRE_DESKS !== "undefined") all = all.concat(EMPIRE_DESKS);
  if (typeof PR_DESKS !== "undefined") all = all.concat(PR_DESKS);
  if (typeof BIZ_DESKS !== "undefined") all = all.concat(BIZ_DESKS);
  if (typeof OTT_DESKS !== "undefined") all = all.concat(OTT_DESKS);
  if (typeof GAMES_DESKS !== "undefined") all = all.concat(GAMES_DESKS);
  if (typeof LIB_DESKS !== "undefined") all = all.concat(LIB_DESKS);
  if (typeof EXHIBITION_DESKS !== "undefined") all = all.concat(EXHIBITION_DESKS);
  if (typeof CREATIVE_DESKS !== "undefined") all = all.concat(CREATIVE_DESKS);
  if (typeof FINANCE_DESKS !== "undefined") all = all.concat(FINANCE_DESKS);
  if (typeof CHALLENGE_DESKS !== "undefined") all = all.concat(CHALLENGE_DESKS);
  if (typeof POSTER_DESKS !== "undefined") all = all.concat(POSTER_DESKS);
  if (typeof PEOPLE_DESKS !== "undefined") all = all.concat(PEOPLE_DESKS);
  if (typeof MEDIA_DESKS !== "undefined") all = all.concat(MEDIA_DESKS);
  if (typeof STRATEGY_DESKS !== "undefined") all = all.concat(STRATEGY_DESKS);
  if (typeof META_DESKS !== "undefined") all = all.concat(META_DESKS);
  if (typeof TECH_DESKS !== "undefined") all = all.concat(TECH_DESKS);
  if (typeof EVENTS2_DESKS !== "undefined") all = all.concat(EVENTS2_DESKS);
  if (typeof BIZDEAL_DESKS !== "undefined") all = all.concat(BIZDEAL_DESKS);
  if (typeof SLOTS_DESKS !== "undefined") all = all.concat(SLOTS_DESKS);
  if (typeof META2_DESKS !== "undefined") all = all.concat(META2_DESKS);
  /* wave-6/7 desks — wired in v42.5 */
  if (typeof CREW_DESKS !== "undefined") all = all.concat(CREW_DESKS);
  if (typeof MASTERY_DESKS !== "undefined") all = all.concat(MASTERY_DESKS);
  if (typeof WORLD_DESKS !== "undefined") all = all.concat(WORLD_DESKS);
  if (typeof LICENSING_DESKS !== "undefined") all = all.concat(LICENSING_DESKS);
  if (typeof AWARDS_DESKS !== "undefined") all = all.concat(AWARDS_DESKS);
  if (typeof FESTIVAL_DESKS !== "undefined") all = all.concat(FESTIVAL_DESKS);
  if (typeof SOCIAL_DESKS !== "undefined") all = all.concat(SOCIAL_DESKS);
  if (typeof STAD_DESKS !== "undefined") all = all.concat(STAD_DESKS);
  return all.concat(MORE_LOCAL);
}
function findDesk(id) {
  var all = collectDesks(), i;
  for (i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
  return null;
}
var LAST_DESK = null;
function refreshDeskSheet() {
  if (!LAST_DESK || el("sheetWrap").hidden) return;
  var b = el("sheetBody"), st = b.scrollTop;
  b.innerHTML = '<div class="sheet-head"><h3>' + LAST_DESK.icon + " " + esc(LAST_DESK.name) + '</h3><button class="sheet-x" data-action="sheet-close"><svg><use href="#i-x"/></svg></button></div><div class="sheet-body">' + LAST_DESK.render() + "</div>";
  b.scrollTop = st;
}
function vMore() {
  var all = collectDesks();
  var groups = [];
  all.forEach(function (d) {
    var g = null, i;
    for (i = 0; i < groups.length; i++) if (groups[i].name === d.group) g = groups[i];
    if (!g) { g = { name: d.group, desks: [] }; groups.push(g); }
    g.desks.push(d);
  });
  var html = '<div class="sechead"><h2>Feature desks · ' + all.length + "</h2></div>";
  groups.forEach(function (g) {
    html += '<div class="sechead"><h2>' + esc(g.name) + "</h2></div><div class='deskgrid'>";
    g.desks.forEach(function (d) {
      html += '<button class="desk" data-action="desk-open" data-id="' + d.id + '"><div class="em">' + d.icon + '</div><div class="nm">' + esc(d.name) + '</div><div class="ds">' + esc(d.desc) + "</div></button>";
    });
    html += "</div>";
  });
  return html;
}
function vAgencyDesk() {
  var html = '<div class="card">';
  if (!S.agency.founded) {
    html += '<div class="empty"><span class="em">🤝</span>An in-house agency signs elite talent exclusively, earns weekly commissions per client and makes poaching attempts rare.</div></div>'
      + '<div class="btnrow"><button class="btn primary grow" data-action="ag-found" ' + (S.studio.cash < 25 ? "disabled" : "") + ">Found the agency · $25M</button></div>";
    return html;
  }
  var com = 0;
  S.agency.clients.forEach(function (id) { var t = findTalent(id); if (t) com += t.power; });
  html += statrow("Roster", S.agency.clients.length + " / 3 clients")
    + statrow("Weekly commissions", fm(com * 0.08), "up")
    + "</div>";
  html += '<div class="sechead"><h2>Sign talent (★★★ and up)</h2></div><div class="talent-row">';
  var cands = S.market.filter(function (t) { return t.power >= 3 && !talentBusy(t) && S.agency.clients.indexOf(t.id) < 0; }).slice(0, 10);
  if (!cands.length) html += '<div class="empty">No available stars right now.</div>';
  cands.forEach(function (t) {
    html += '<button class="person" data-action="ag-sign" data-id="' + t.id + '"><div class="nm">' + esc(t.n) + '</div><div class="st">' + "★".repeat(t.power) + (abilityOf(t) ? " · " + esc(abilityOf(t).n) : "") + '</div><div class="fee">Sign</div></button>';
  });
  html += "</div>";
  if (S.agency.clients.length) {
    html += '<div class="sechead"><h2>Your clients</h2></div><div class="card">';
    S.agency.clients.forEach(function (id) {
      var t = findTalent(id);
      if (t) html += statrow(esc(t.n) + " · " + "★".repeat(t.power) + (t.picDeal ? " · " + t.picDeal.pics + "-pic deal" : ""),
        '<span class="btnrow">' + (t.picDeal && t.picDeal.pics < 5 ? '<button class="btn sm" data-action="ag-upgrade" data-id="' + t.id + '">5-pic</button>' : "")
        + '<button class="btn sm" data-action="ag-drop" data-id="' + t.id + '">Drop</button></span>');
    });
    html += "</div>";
  }
  return html;
}
function vLotDesk() {
  var html = '<div class="card">';
  ["writers", "crew", "vfx"].forEach(function (k) {
    var r = LOT_ROLES[k];
    html += '<div class="statrow"><span class="k">' + r.n;
    html += '<br><small style="color:var(--faint)">' + r.d + " · " + fm(r.wage) + "/wk each</small></span>";
    html += '<span class="btnrow">';
    html += '<button class="btn sm" data-action="lot-fire" data-key="' + k + '" ' + (S.lot[k] <= 0 ? "disabled" : "") + '>−</button>';
    html += '<span class="tag gold">' + S.lot[k] + "/10</span>";
    html += '<button class="btn sm" data-action="lot-hire" data-key="' + k + '" ' + (S.lot[k] >= 10 || S.studio.cash < 0.5 ? "disabled" : "") + '>+ $0.5M</button>';
    html += '</span></div>';
  });
  html += '</div><div class="card"><div class="empty" style="padding:8px 0 0">Current effect: +' + (S.lot.writers * 0.5).toFixed(1) + " script quality on new ideas · +" + Math.min(S.lot.crew * 1.2 + S.lot.vfx * 1.6, 12).toFixed(1) + " production values (cap +12)</div></div>";
  return html;
}

/* ── combined cashflow adjustments from every module ─────────── */
function forecastAdjust(weekAbs) {
  var n = 0;
  if (typeof forecastAdjust_tv === "function") n += forecastAdjust_tv(weekAbs) || 0;
  if (typeof forecastAdjust_ott === "function") n += forecastAdjust_ott(weekAbs) || 0;
  if (typeof forecastAdjust_games === "function") n += forecastAdjust_games(weekAbs) || 0;
  if (typeof forecastAdjust_strategy === "function") n += forecastAdjust_strategy(weekAbs) || 0;
  return n;
}

/* ── restored cast banks: merge v41 name banks + BOS2 cast DB into the engine pools ── */
function mergeCastBanks() {
  var i, j, n, seen = {};
  var F = FIRST_NAMES.slice(), L = LAST_NAMES.slice();
  for (i = 0; i < F.length; i++) seen[F[i]] = 1;
  for (i = 0; i < L.length; i++) seen[L[i]] = 1;
  function addAll(src, out) {
    if (!src) return;
    for (j = 0; j < src.length; j++) { n = src[j]; if (n && !seen[n]) { seen[n] = 1; out.push(n); } }
  }
  var D = (typeof window !== "undefined" && window.DATA) || null;
  if (D) { addAll(D.FIRST_M, F); addAll(D.FIRST_F, F); addAll(D.LAST, L); }
  var B = (typeof window !== "undefined" && window.BOS2_CAST) || null;
  if (B) { addAll(B.peopleMale, F); addAll(B.peopleFemale, F); addAll(B.peopleLast, L); }
  FIRST_NAMES.length = 0;
  for (i = 0; i < F.length; i++) FIRST_NAMES.push(F[i]);
  LAST_NAMES.length = 0;
  for (i = 0; i < L.length; i++) LAST_NAMES.push(L[i]);
  if (B && Array.isArray(B.abilities)) {
    var have = {};
    for (i = 0; i < ABILITIES.length; i++) have[ABILITIES[i].id] = 1;
    for (i = 0; i < B.abilities.length; i++) {
      var ab = B.abilities[i], id2 = "bos2_" + ab.id;
      if (!have[id2]) { have[id2] = 1; ABILITIES.push({ id: id2, n: ab.n, d: ab.d }); }
    }
  }
}

function boot() {
  mergeCastBanks();
  wire();
  if (typeof applyPrefs === "function") applyPrefs();
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window.__deferredPrompt = e;
    if (VIEW === "start") render();
  });
  var has = loadGame();
  VIEW = has ? (S.over ? "gameover" : "studio") : "start";
  render();
  drainFlash();
}
boot();
