/* Box Office War — rebuilt. Exhibition empire module — all state under S.exh.
   Systems: chain ownership (5 circuits, own up to 2, weekly concessions per screen)
   · per-chain premium upgrades (Dolby/VIP/4DX yield boosts) · PLF mastering for films
   in shoot/post/ready (IMAX 70mm / Dolby Cinema / 4DX opening surcharges) · one global
   concession backend deal (rental-split trade) · Thursday previews · 6-week re-release
   mini-runs on finished hits.
   Wiring: engine.js already calls tickExhibition() inside advanceWeek() and applies the
   exhibitionGrossMult/rentalSplitMult/plfOpeningMult hooks inside tickTheatrical /
   expectedOpening / endTheatrical; ui.js bridges exhibitionAction() and appends
   EXHIBITION_DESKS in collectDesks(). No self-wiring. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var EXH_CHAINS = [
  { id: "regalogue",  name: "Regalogue",           screens: 3600, cost: 280, rep: 60 },
  { id: "amccine",    name: "AMCCine",             screens: 2200, cost: 190, rep: 50 },
  { id: "cinemarked", name: "CineMarked",          screens: 1800, cost: 150, rep: 45 },
  { id: "harkinsy",   name: "Harkinsy",            screens: 1200, cost: 100, rep: 40 },
  { id: "bowtie",     name: "Bowtie Independents", screens: 960,  cost: 70,  rep: 35 }
];
var EXH_UPGRADES = [
  { id: "dolby", name: "Dolby", cost: 3, yield: 0.08 },
  { id: "vip",   name: "VIP",   cost: 6, yield: 0.15 },
  { id: "4dx",   name: "4DX",   cost: 5, yield: 0.10 }
];
var EXH_PLF = [
  { id: "imax",  name: "IMAX 70mm",    cost: 2.5, surcharge: 0.35 },
  { id: "dolby", name: "Dolby Cinema", cost: 1.8, surcharge: 0.28 },
  { id: "4dx",   name: "4DX",          cost: 1.2, surcharge: 0.20 }
];
var EXH_DEALS = [
  { id: "std",    name: "Standard",   split: 1,    conc: 1 },
  { id: "shared", name: "Shared 12%", split: 0.94, conc: 1.5 },
  { id: "max",    name: "Max 20%",    split: 0.90, conc: 2 }
];
var EXH_MASTER_PHASES = ["shoot", "post", "ready"];
var EXH_PREVIEW_COST = 1, EXH_PREVIEW_BUZZ = 15;
var EXH_RERELEASE_COST = 3, EXH_RERELEASE_MIN_WW = 50, EXH_RERELEASE_WEEKS = 6, EXH_RERELEASE_COOLDOWN = 52;

/* ── state (lazy ensure — old saves have no S.exh) ────────────── */
function exhEnsure() {
  if (!S.exh) S.exh = { lastTick: 0, owned: [], deal: "std", reruns: [] };
  if (!S.exh.owned) S.exh.owned = [];
  if (!S.exh.reruns) S.exh.reruns = [];
  if (!S.exh.deal) S.exh.deal = "std";
}

function exhFindChain(id) { var i; for (i = 0; i < EXH_CHAINS.length; i++) if (EXH_CHAINS[i].id === id) return EXH_CHAINS[i]; return null; }
function exhFindUpg(id) { var i; for (i = 0; i < EXH_UPGRADES.length; i++) if (EXH_UPGRADES[i].id === id) return EXH_UPGRADES[i]; return null; }
function exhFindPlf(id) { var i; for (i = 0; i < EXH_PLF.length; i++) if (EXH_PLF[i].id === id) return EXH_PLF[i]; return null; }
function exhFindOwned(id) { var i; for (i = 0; i < S.exh.owned.length; i++) if (S.exh.owned[i].id === id) return S.exh.owned[i]; return null; }
function exhDeal() { var i; for (i = 0; i < EXH_DEALS.length; i++) if (EXH_DEALS[i].id === S.exh.deal) return EXH_DEALS[i]; return EXH_DEALS[0]; }
function exhOwnedScreens() { var n = 0, i; for (i = 0; i < S.exh.owned.length; i++) n += S.exh.owned[i].screens; return n; }
function exhFilmsRunning() { var n = 0, i; for (i = 0; i < S.films.length; i++) if (S.films[i].status === "run") n++; return n; }

/* Concession yield of one owned chain: 1 + owned upgrade boosts. */
function exhUpgradeYield(o) {
  var y = 1, i;
  for (i = 0; i < EXH_UPGRADES.length; i++) {
    if (o.upgrades.indexOf(EXH_UPGRADES[i].id) >= 0) y += EXH_UPGRADES[i].yield;
  }
  return y;
}

/* ── engine hooks (typeof-guarded calls from engine.js) ───────── */
function exhibitionGrossMult(f) {
  if (!S) return 1;
  exhEnsure();
  return 1 + (exhOwnedScreens() / 40000) * 0.5;
}
function rentalSplitMult() {
  if (!S) return 1;
  exhEnsure();
  return exhDeal().split;
}
function plfOpeningMult(p) {
  return p && p.plf ? 1 + p.plf.surcharge : 1;
}

/* ── mechanics ────────────────────────────────────────────────── */
function exhBuyChain(id) {
  var ch = exhFindChain(id);
  if (!ch) return { err: "Unknown circuit." };
  if (exhFindOwned(id)) return { err: "You already own " + ch.name + "." };
  if (S.exh.owned.length >= 2) return { err: "You can run at most 2 circuits." };
  if (S.studio.rep < ch.rep) return { err: "Reputation " + ch.rep + " required for " + ch.name + "." };
  if (S.studio.cash < ch.cost) return { err: "Need " + fm(ch.cost) + " to buy " + ch.name + "." };
  spend(ch.cost, "Acquisition · " + ch.name);
  S.exh.owned.push({ id: ch.id, screens: ch.screens, upgrades: [] });
  log(ch.name + " joins the empire — " + ch.screens + " screens under your flag. Weekly gross mult ×" + exhibitionGrossMult(null).toFixed(3) + ".", "gold", "🏟️");
  toast("🏟️ " + ch.name + " acquired.", "good");
  return { ok: true };
}

function exhUpgrade(id, upgId) {
  var o = exhFindOwned(id), u = exhFindUpg(upgId);
  if (!o) return { err: "You do not own that circuit." };
  if (!u) return { err: "Unknown premium format." };
  if (o.upgrades.indexOf(u.id) >= 0) return { err: chName(o.id) + " already has " + u.name + "." };
  if (S.studio.cash < u.cost) return { err: "Need " + fm(u.cost) + " for the " + u.name + " retrofit." };
  spend(u.cost, "Premium retrofit · " + chName(o.id) + " · " + u.name);
  o.upgrades.push(u.id);
  log(u.name + " auditoriums roll out across " + chName(o.id) + " — concession yield +" + Math.round(u.yield * 100) + "%.", "good", "🍿");
  return { ok: true };
}

function chName(id) { var ch = exhFindChain(id); return ch ? ch.name : id; }

function exhSetDeal(dealId) {
  var i;
  for (i = 0; i < EXH_DEALS.length; i++) {
    if (EXH_DEALS[i].id === dealId) {
      S.exh.deal = dealId;
      log("Concession backend deal switched to " + EXH_DEALS[i].name + " — rental split ×" + EXH_DEALS[i].split.toFixed(2) + ", concessions ×" + EXH_DEALS[i].conc + ".", "", "🍿");
      return { ok: true };
    }
  }
  return { err: "Unknown backend deal." };
}

function exhPlfMaster(projId, fmtId) {
  var p = findProject(projId), fmt = exhFindPlf(fmtId);
  if (!p) return { err: "Unknown project." };
  if (!fmt) return { err: "Unknown premium format." };
  if (p.plf) return { err: "“" + p.title + "” is already mastered in a premium format." };
  if (EXH_MASTER_PHASES.indexOf(p.phase) < 0) return { err: "Mastering needs the film in shoot, post or ready." };
  if (S.studio.cash < fmt.cost) return { err: "Need " + fm(fmt.cost) + " to master in " + fmt.name + "." };
  spend(fmt.cost, "PLF master · " + p.title + " · " + fmt.name);
  p.plf = { fmt: fmt.id, surcharge: fmt.surcharge };
  p.buzz += 12;
  log("“" + p.title + "” mastered for " + fmt.name + " — premium ticket surcharge +" + Math.round(fmt.surcharge * 100) + "% on opening.", "good", "🎞️");
  toast("🎞️ " + fmt.name + " master locked for “" + p.title + "”.", "good");
  return { ok: true };
}

function exhBuyPreview(projId) {
  var p = findProject(projId);
  if (!p) return { err: "Unknown project." };
  if (p.releaseWeek == null) return { err: "Schedule a release date first — previews need an opening." };
  if (p.previews) return { err: "“" + p.title + "” already has Thursday previews booked." };
  if (S.studio.cash < EXH_PREVIEW_COST) return { err: "Need " + fm(EXH_PREVIEW_COST) + " to book previews." };
  spend(EXH_PREVIEW_COST, "Thursday previews · " + p.title);
  p.previews = true;
  p.buzz += EXH_PREVIEW_BUZZ;
  log("Thursday previews booked for “" + p.title + "” — fans pack the first shows, buzz +" + EXH_PREVIEW_BUZZ + ".", "good", "🎟️");
  return { ok: true };
}

function exhBuyRerelease(filmId) {
  var f = findFilm(filmId);
  if (!f) return { err: "Unknown film." };
  if (f.status !== "done") return { err: "Only finished runs can be re-released." };
  if (!isFinite(f.ww) || f.ww < EXH_RERELEASE_MIN_WW) return { err: "Needs a " + fm(EXH_RERELEASE_MIN_WW) + "+ worldwide run to draw a crowd." };
  if (f.lastRerelease && S.studio.week - f.lastRerelease < EXH_RERELEASE_COOLDOWN) {
    return { err: "“" + f.title + "” was re-released recently — wait " + (EXH_RERELEASE_COOLDOWN - (S.studio.week - f.lastRerelease)) + " more week(s)." };
  }
  if (S.studio.cash < EXH_RERELEASE_COST) return { err: "Need " + fm(EXH_RERELEASE_COST) + " to book the re-release." };
  spend(EXH_RERELEASE_COST, "Re-release booking · " + f.title);
  S.exh.reruns.push({ filmId: f.id, title: f.title, ww: f.ww, weeks: EXH_RERELEASE_WEEKS });
  f.lastRerelease = S.studio.week;
  log("“" + f.title + "” returns to " + chPlural() + " for a " + EXH_RERELEASE_WEEKS + "-week anniversary run — " + fm(f.ww * 0.01) + "/week in rentals.", "gold", "🔁");
  toast("🔁 “" + f.title + "” re-release booked.", "good");
  return { ok: true };
}

function chPlural() { return S.exh.owned.length ? (S.exh.owned.length === 1 ? "your circuit" : "your circuits") : "independent houses"; }
function exhPlfName(id) { var fmt = exhFindPlf(id); return fmt ? fmt.name : id; }

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickExhibition() {
  if (!S || S.over) return;
  exhEnsure();
  if (S.exh.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.exh.lastTick = S.studio.week;
  var deal = exhDeal(), films = exhFilmsRunning(), i, ch;
  if (films > 0) {
    for (i = 0; i < S.exh.owned.length; i++) {
      ch = exhFindChain(S.exh.owned[i].id);
      if (!ch) continue;
      earn(ch.screens * 0.0006 * films * exhUpgradeYield(S.exh.owned[i]) * deal.conc, "Concessions · " + ch.name);
    }
  }
  for (i = S.exh.reruns.length - 1; i >= 0; i--) {
    var rr = S.exh.reruns[i];
    earn(Math.round(rr.ww * 0.01 * 10) / 10, "Re-release · " + rr.title);
    rr.weeks--;
    if (rr.weeks <= 0) S.exh.reruns.splice(i, 1);
  }
}

/* ── commit + action delegation (ui calls exhibitionAction) ───── */
function exhCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function exhHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return false; }
  exhCommit();
  return true;
}
function exhibitionAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("exh-") !== 0) return false;
  exhEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  switch (a) {
    case "exh-buy": exhHandle(exhBuyChain(id)); break;
    case "exh-upgrade": exhHandle(exhUpgrade(id, key)); break;
    case "exh-deal": exhHandle(exhSetDeal(key)); break;
    case "exh-plf-master": exhHandle(exhPlfMaster(id, key)); break;
    case "exh-preview": exhHandle(exhBuyPreview(id)); break;
    case "exh-rerelease": exhHandle(exhBuyRerelease(id)); break;
    default: return false;
  }
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function exhChainsDesk() {
  exhEnsure();
  var films = exhFilmsRunning(), deal = exhDeal(), est = 0, i, j, o, ch, u;
  for (i = 0; i < S.exh.owned.length; i++) {
    ch = exhFindChain(S.exh.owned[i].id);
    if (ch) est += ch.screens * 0.0006 * films * exhUpgradeYield(S.exh.owned[i]) * deal.conc;
  }
  var html = '<div class="card">'
    + '<div class="statrow"><span class="k">Circuits owned</span><span class="v">' + S.exh.owned.length + " / 2</span></div>"
    + '<div class="statrow"><span class="k">Screens under your flag</span><span class="v num">' + exhOwnedScreens() + "</span></div>"
    + '<div class="statrow"><span class="k">Weekly gross mult on every release</span><span class="v num up">×' + exhibitionGrossMult(null).toFixed(3) + "</span></div>"
    + '<div class="statrow"><span class="k">Weekly concessions' + (films ? "" : " — nothing in release") + '</span><span class="v num ' + (est > 0 ? "up" : "") + '">' + (est > 0 ? "+" : "") + fm(est) + "</span></div>"
    + "</div>";
  if (!S.exh.owned.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏟️</span>No circuits owned yet. A chain adds screens — a bigger footprint lifts every film\'s weekly gross and rings up concessions all year.</div></div>';
  }
  for (i = 0; i < S.exh.owned.length; i++) {
    o = S.exh.owned[i];
    ch = exhFindChain(o.id);
    html += '<div class="card film">'
      + '<div class="head"><div class="title">🏟️ ' + esc(ch ? ch.name : o.id) + "</div>" + tag(o.screens + " screens", "blue") + "</div>"
      + '<div class="meta">';
    for (j = 0; j < o.upgrades.length; j++) html += tag("✦ " + chName(o.upgrades[j]), "gold");
    if (!o.upgrades.length) html += tag("No premium retrofits");
    html += "</div>";
    var pending = false;
    for (j = 0; j < EXH_UPGRADES.length; j++) {
      u = EXH_UPGRADES[j];
      if (o.upgrades.indexOf(u.id) >= 0) continue;
      pending = true;
      html += '<div class="statrow"><span class="k">' + u.name + " retrofit · +" + Math.round(u.yield * 100) + "% concession yield · " + fm(u.cost) + "</span>"
        + '<button class="btn sm" data-action="exh-upgrade" data-id="' + o.id + '" data-key="' + u.id + '" ' + (S.studio.cash >= u.cost ? "" : "disabled") + ">Retrofit</button></div>";
    }
    if (!pending) html += '<div class="statrow"><span class="k">Fully upgraded</span><span class="v num up">×' + exhUpgradeYield(o).toFixed(2) + " yield</span></div>";
    html += "</div>";
  }
  html += '<div class="sechead"><h2>Circuits for sale</h2></div><div class="card">';
  var full = S.exh.owned.length >= 2;
  if (full) html += '<div class="statrow"><span class="k">Portfolio full — sell out of one circuit before buying another</span><span class="v">2 / 2</span></div>';
  for (i = 0; i < EXH_CHAINS.length; i++) {
    ch = EXH_CHAINS[i];
    if (exhFindOwned(ch.id)) continue;
    var lowRep = S.studio.rep < ch.rep;
    var canBuy = !full && !lowRep && S.studio.cash >= ch.cost;
    html += '<div class="statrow"><span class="k">' + esc(ch.name) + " · " + ch.screens + " screens · rep " + ch.rep + " required"
      + (lowRep ? " — you have " + S.studio.rep : "") + "</span>"
      + '<button class="btn sm" data-action="exh-buy" data-id="' + ch.id + '" ' + (canBuy ? "" : "disabled") + ">Buy · " + fm(ch.cost) + " · cash after " + fm(S.studio.cash - ch.cost) + "</button></div>";
  }
  html += "</div>";
  return html;
}

function exhPlfDesk() {
  exhEnsure();
  var deal = exhDeal(), html = "", i, p;
  html += '<div class="field-label">Concession backend deal — one global contract, switching is free</div><div class="seg">';
  for (i = 0; i < EXH_DEALS.length; i++) {
    html += '<button class="' + (S.exh.deal === EXH_DEALS[i].id ? "on" : "") + '" data-action="exh-deal" data-key="' + EXH_DEALS[i].id + '">' + EXH_DEALS[i].name + "</button>";
  }
  html += "</div>"
    + '<div class="card">'
    + '<div class="statrow"><span class="k">Rental share on every film</span><span class="v num">×' + rentalSplitMult().toFixed(2) + "</span></div>"
    + '<div class="statrow"><span class="k">Concession take</span><span class="v num up">×' + deal.conc + "</span></div>"
    + '<div class="statrow"><span class="k">Trade-off</span><span class="v">keep less of rentals, keep more of popcorn</span></div>'
    + "</div>";
  html += '<div class="sechead"><h2>Premium format mastering</h2></div>';
  var any = false;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (!p.plf && EXH_MASTER_PHASES.indexOf(p.phase) >= 0) {
      any = true;
      html += '<div class="card film">'
        + '<div class="head"><div class="title">' + esc(p.title) + "</div>" + tag(p.phase === "shoot" ? "Shooting" : p.phase === "post" ? "In post" : "Ready", "blue") + "</div>"
        + '<div class="meta">' + tag("Buzz " + (p.buzz || 0)) + tag("Mastering adds +12 buzz") + "</div>";
      for (var j = 0; j < EXH_PLF.length; j++) {
        var fmt = EXH_PLF[j];
        html += '<div class="statrow"><span class="k">' + fmt.name + " · +" + Math.round(fmt.surcharge * 100) + "% opening surcharge · " + fm(fmt.cost) + "</span>"
          + '<button class="btn sm" data-action="exh-plf-master" data-id="' + p.id + '" data-key="' + fmt.id + '" ' + (S.studio.cash >= fmt.cost ? "" : "disabled") + ">Master</button></div>";
      }
      html += "</div>";
    }
  }
  if (!any) html += '<div class="card"><div class="empty"><span class="em">🎞️</span>Nothing to master — films in shooting, post or ready show up here for IMAX 70mm, Dolby Cinema and 4DX passes.</div></div>';
  var mastered = "";
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.plf) mastered += '<div class="statrow"><span class="k">' + esc(p.title) + "</span><span class=\"v num up\">×" + plfOpeningMult(p).toFixed(2) + " opening · " + esc(exhPlfName(p.plf.fmt)) + "</span></div>";
  }
  if (mastered) html += '<div class="card">' + mastered + "</div>";
  return html;
}

function exhPreviewsDesk() {
  exhEnsure();
  var html = "", i, p, f;
  html += '<div class="sechead"><h2>Thursday previews</h2></div>';
  var any = false;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.releaseWeek != null && !p.previews) {
      any = true;
      html += '<div class="card"><div class="statrow"><span class="k">' + esc(p.title) + " · opens in " + Math.max(0, p.releaseWeek - S.studio.week) + " wk · buzz +" + EXH_PREVIEW_BUZZ + "</span>"
        + '<button class="btn sm" data-action="exh-preview" data-id="' + p.id + '" ' + (S.studio.cash >= EXH_PREVIEW_COST ? "" : "disabled") + ">Book · " + fm(EXH_PREVIEW_COST) + "</button></div></div>";
    } else if (p.previews) {
      any = true;
      html += '<div class="card"><div class="statrow"><span class="k">' + esc(p.title) + '</span><span class="v">' + tag("Preview booked", "gold") + "</span></div></div>";
    }
  }
  if (!any) html += '<div class="card"><div class="empty"><span class="em">🎟️</span>No scheduled releases. Lock a release date on a ready film, then book its Thursday previews.</div></div>';
  html += '<div class="sechead"><h2>Re-releases</h2></div>';
  var anyRR = false;
  for (i = 0; i < S.exh.reruns.length; i++) {
    anyRR = true;
    html += '<div class="card"><div class="statrow"><span class="k">🔁 ' + esc(S.exh.reruns[i].title) + "</span><span class=\"v num up\">+" + fm(S.exh.reruns[i].ww * 0.01) + "/wk · " + S.exh.reruns[i].weeks + " wk left</span></div></div>";
  }
  var eligible = false;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done" || !isFinite(f.ww) || f.ww < EXH_RERELEASE_MIN_WW) continue;
    eligible = true;
    var cd = f.lastRerelease ? EXH_RERELEASE_COOLDOWN - (S.studio.week - f.lastRerelease) : 0;
    var can = cd <= 0 && S.studio.cash >= EXH_RERELEASE_COST;
    html += '<div class="card"><div class="statrow"><span class="k">' + esc(f.title) + " · " + fm(f.ww) + " worldwide · +" + fm(f.ww * 0.01) + "/wk for " + EXH_RERELEASE_WEEKS + " wk"
      + (cd > 0 ? " — cooldown " + cd + " wk" : "") + "</span>"
      + '<button class="btn sm" data-action="exh-rerelease" data-id="' + f.id + '" ' + (can ? "" : "disabled") + ">Book · " + fm(EXH_RERELEASE_COST) + "</button></div></div>";
  }
  if (!eligible && !anyRR) html += '<div class="card"><div class="empty"><span class="em">🔁</span>Finished runs of ' + fm(EXH_RERELEASE_MIN_WW) + "+ worldwide can return to theaters for a six-week anniversary run.</div></div>";
  return html;
}

var EXHIBITION_DESKS = [
  { id: "exh-chains", group: "Exhibition", icon: "🏟️", name: "Chain ownership", desc: "Buy theater circuits (max 2) — every owned screen lifts weekly gross and earns concessions; retrofit Dolby, VIP and 4DX.", render: exhChainsDesk },
  { id: "exh-plf", group: "Exhibition", icon: "🎞️", name: "Premium formats", desc: "Master upcoming films for IMAX 70mm, Dolby Cinema and 4DX opening surcharges, and pick the concession backend deal.", render: exhPlfDesk },
  { id: "exh-previews", group: "Exhibition", icon: "🎟️", name: "Previews & re-releases", desc: "Book Thursday previews to supercharge an opening, and send finished hits back to theaters for six-week runs.", render: exhPreviewsDesk }
];
