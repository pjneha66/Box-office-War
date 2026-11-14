/* Box Office War — rebuilt. Media & press module (wave 4).
   Systems: critic relationships (court/slam, drift to 0), trailer market,
   script development passes, ratings-board assignment + appeals, festival
   premiere bidding (wk 34–38). All state lives under S.med (lazy medEnsure()).
   Engine hooks defined here (typeof-guarded on the engine side):
   - criticRelAdj(criticName) → per-critic review score add (LIVE in reviewFilm).
   - forecastAdjust() → 0 (media moves cash only at action time, never weekly;
     uniform with finance/library — note the forecastAdjust global is multi-defined
     across modules and last-loaded wins; integrator owns load order).
   NOTE for integrator (fields defined here, wired by YOU in engine releaseFilm):
   - p.ratingAud — number added to audience score at release (appeals set −3/−2/+4).
   - p.cut — true after a PG-13 recut; apply quality −2 at release. This module
     never subtracts quality directly.
   Also consumed by the integrator: S.pending = { type:"appeal", projectId } set
   when a project first draws an R (guarded — never overwrites an existing pending
   event; the desk below is the always-open fallback). */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var MED_COURT = { cost: 0.8, delta: 3, cd: 6 };
var MED_SLAM = { cost: 0, delta: -5, rep: -1, cd: 8 };
var MED_TRAILER_COST = 1.5;
var MED_PASS_COSTS = [0.8, 1.6, 3.2];
var MED_PRESTIGE = ["drama", "crime", "romance", "docs", "musical"];
var MED_PREMIERES = [
  { name: "Cannes",   cost: 4, rep: 5, buzz: 4 },
  { name: "Sundance", cost: 2, rep: 2, buzz: 6 },
  { name: "Venice",   cost: 3, rep: 3, buzz: 5 }
];

/* ── state ────────────────────────────────────────────────────── */
function medEnsure() {
  if (!S.med) S.med = {};
  var M = S.med, i, c;
  if (!M.rel) M.rel = {};            /* critic full name → score −10..+10 */
  if (!M.cd) M.cd = {};              /* critic name → { court: absWk, slam: absWk } */
  if (!M.trailers) M.trailers = {};  /* projectId → views in M (2.0–9.0) */
  if (!M.passes) M.passes = {};      /* projectId → script passes bought (0–3) */
  if (!M.premieres) M.premieres = {};/* projectId → festival name */
  for (i = 0; i < CRITICS.length; i++) {
    c = CRITICS[i];
    if (M.rel[c.n] == null) M.rel[c.n] = 0;
  }
}

/* ── engine hook: per-critic review score add ─────────────────── */
function criticRelAdj(criticName) {
  if (!S || !S.med || !S.med.rel) return 0;
  var v = S.med.rel[criticName];
  return v == null ? 0 : v;
}

/* ── engine hook: no weekly recurring cash from media ─────────── */
function forecastAdjust_media() { return 0; }

/* ── mechanic 1a: court a critic ($0.8M, +3, cd 6wk) ──────────── */
function medCdLeft(name, kind) {
  var used = S.med.cd[name] ? S.med.cd[name][kind] : null;
  if (used == null) return 0;
  var need = kind === "court" ? MED_COURT.cd : MED_SLAM.cd;
  return Math.max(0, used + need - S.studio.week);
}
function medCritic(name) {
  var i;
  for (i = 0; i < CRITICS.length; i++) if (CRITICS[i].n === name) return CRITICS[i];
  return null;
}
function medCourt(name) {
  medEnsure();
  var M = S.med, c = medCritic(name);
  if (!c) return { err: "That critic is not on the beat." };
  if (medCdLeft(name, "court") > 0) return { err: c.n.split(",")[0] + " is still flattered from the last dinner — " + medCdLeft(name, "court") + " wk(s) on cooldown." };
  if (S.studio.cash < MED_COURT.cost) return { err: "Need " + fm(MED_COURT.cost) + " free cash for the dinner." };
  spend(MED_COURT.cost, "Critic dinner · " + c.n.split(",")[0]);
  if (!M.cd[name]) M.cd[name] = {};
  M.cd[name].court = S.studio.week;
  M.rel[name] = clamp((M.rel[name] || 0) + MED_COURT.delta, -10, 10);
  log("🍖 Long dinner with " + c.n.split(",")[0] + " — the relationship warms (" + (M.rel[name] >= 0 ? "+" : "") + M.rel[name] + ").", "good", "🎙️");
  toast("Relationship with " + c.n.split(",")[0] + " now " + (M.rel[name] >= 0 ? "+" : "") + M.rel[name] + ".", "good");
  return { ok: true, score: M.rel[name] };
}

/* ── mechanic 1b: slam a critic publicly ($0, rep −1, −5, cd 8wk) ── */
function medSlam(name) {
  medEnsure();
  var M = S.med, c = medCritic(name);
  if (!c) return { err: "That critic is not on the beat." };
  if (medCdLeft(name, "slam") > 0) return { err: "You just slammed " + c.n.split(",")[0] + " — " + medCdLeft(name, "slam") + " wk(s) before the next broadside." };
  if (!M.cd[name]) M.cd[name] = {};
  M.cd[name].slam = S.studio.week;
  M.rel[name] = clamp((M.rel[name] || 0) + MED_SLAM.delta, -10, 10);
  S.studio.rep = clamp(S.studio.rep + MED_SLAM.rep, 0, 100);
  log("📢 The studio slams " + c.n.split(",")[0] + " in the trades — the relationship chills (" + M.rel[name] + ").", "bad", "🎙️");
  toast("Rep −1 · relationship with " + c.n.split(",")[0] + " now " + M.rel[name] + ".", "bad");
  return { ok: true, score: M.rel[name] };
}

/* ── mechanic 2: trailer market ($1.5M, one per project) ──────── */
function medTrailer(pid) {
  medEnsure();
  var M = S.med, p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.releaseWeek == null) return { err: "Set a release date first — a trailer sells a date." };
  if (M.trailers[pid] != null) return { err: "“" + p.title + "” already has its one trailer." };
  if (S.studio.cash < MED_TRAILER_COST) return { err: "Need " + fm(MED_TRAILER_COST) + " for the trailer." };
  spend(MED_TRAILER_COST, "Trailer · " + p.title);
  var raw = ri(200, 900);          /* hundreds of millions of first-week views */
  var views = raw / 100;
  M.trailers[pid] = views;
  var gain = raw >= 700 ? 10 : raw >= 400 ? 6 : 2;
  p.buzz += gain;
  if (raw >= 700) {
    log("🍿 The “" + p.title + "” trailer goes VIRAL — " + views.toFixed(1) + "M views in week one. Buzz +" + gain + ".", "gold", "🍿");
    toast("“" + p.title + "” trailer is everywhere. Buzz +" + gain + ".", "gold");
  } else if (raw >= 400) {
    log("🍿 “" + p.title + "” trailer lands solid — " + views.toFixed(1) + "M views. Buzz +" + gain + ".", "good", "🍿");
    toast("Solid trailer run. Buzz +" + gain + ".", "good");
  } else {
    log("🍿 “" + p.title + "” trailer sinks quietly — " + views.toFixed(1) + "M views. Buzz +" + gain + ".", "", "🍿");
    toast("The trailer barely dented the feed.", "");
  }
  return { ok: true, views: views, gain: gain };
}

/* ── mechanic 3: script development passes (max 3, escalating) ── */
function medPass(pid) {
  medEnsure();
  var M = S.med, p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "pre" && p.phase !== "shoot") return { err: "Script passes run in pre-production or shoot." };
  var n = M.passes[pid] || 0;
  if (n >= MED_PASS_COSTS.length) return { err: "Three passes is the ceiling — the script is what it is." };
  var cost = MED_PASS_COSTS[n];
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for script pass " + (n + 1) + "." };
  spend(cost, "Script pass " + (n + 1) + " · " + p.title);
  var gain = ri(3, 6);
  p.script += gain;
  M.passes[pid] = n + 1;
  log("📝 Script pass " + (n + 1) + " on “" + p.title + "” — the draft sharpens, script +" + gain + " (now " + p.script + ").", "good", "📝");
  toast("“" + p.title + "” script now " + p.script + ".", "good");
  return { ok: true, gain: gain, script: p.script };
}

/* ── mechanic 4: ratings board (assigned once at ready) ───────── */
function medRatingFor(genre) {
  if (genre === "horror" || genre === "thriller") return "R";
  if (genre === "animation" || genre === "docs") return "G";
  if (genre === "comedy" || genre === "romance") return "PG";
  return "PG-13";
}
function medRated(pid) {
  var p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "ready") return { err: "Appeals run once a project is ready." };
  if (p.rating !== "R") return { err: "Only R-rated projects can appeal." };
  if (p.appealDone) return { err: "The board already ruled on “" + p.title + "”." };
  return { ok: true, p: p };
}
function medAcceptR(pid) {
  var g = medRated(pid);
  if (g.err) return g;
  g.p.ratingAud = -3;              /* integrator: added to aud at release */
  g.p.appealDone = true;
  log("📋 “" + g.p.title + "” keeps its R — the board flags it for adult audiences (aud −3 at release).", "", "📋");
  toast("“" + g.p.title + "” ships rated R.", "");
  return { ok: true, ratingAud: -3 };
}
function medAppealR(pid) {
  var g = medRated(pid);
  if (g.err) return g;
  if (S.studio.cash < 1) return { err: "Need " + fm(1) + " to file the appeal." };
  spend(1, "Ratings appeal · " + g.p.title);
  g.p.appealDone = true;
  if (chance(0.6)) {
    g.p.rating = "PG-13";
    g.p.ratingAud = 4;
    log("📋 The appeal WINS — “" + g.p.title + "” is re-rated PG-13 (aud +4 at release).", "gold", "📋");
    toast("“" + g.p.title + "” re-rated PG-13!", "gold");
  } else {
    g.p.ratingAud = -2;
    log("📋 The appeal fails — “" + g.p.title + "” stays rated R (aud −2 at release).", "bad", "📋");
    toast("Appeal denied. The R stands.", "bad");
  }
  return { ok: true, won: g.p.rating === "PG-13" };
}
function medCutPG(pid) {
  var g = medRated(pid);
  if (g.err) return g;
  if (S.studio.cash < 2.5) return { err: "Need " + fm(2.5) + " for the recut." };
  spend(2.5, "PG-13 recut · " + g.p.title);
  g.p.cut = true;                  /* integrator: quality −2 at release */
  g.p.rating = "PG-13";
  g.p.ratingAud = 4;
  g.p.appealDone = true;
  log("✂️ “" + g.p.title + "” is recut for PG-13 — softer, blander, board approved (quality −2, aud +4 at release).", "", "✂️");
  toast("“" + g.p.title + "” recut to PG-13.", "");
  return { ok: true, cut: true };
}

/* ── mechanic 5: festival premiere bidding (wk 34–38) ─────────── */
function medPremiere(pid, idx) {
  medEnsure();
  var M = S.med, p = findProject(pid), f = MED_PREMIERES[idx];
  if (!p) return { err: "That project is gone." };
  if (!f) return { err: "Pick a festival to bid on." };
  var woy = woyOf(S.studio.week);
  if (woy < 34 || woy > 38) return { err: "Premiere auctions run weeks 34–38." };
  if (p.phase !== "post" && p.phase !== "ready") return { err: "Only projects in post or ready can premiere." };
  if (MED_PRESTIGE.indexOf(p.genre) < 0) return { err: genreOf(p.genre).name + " is not a premiere genre (drama, crime, romance, docs, musical)." };
  if (M.premieres[pid]) return { err: "“" + p.title + "” already premiered at " + M.premieres[pid] + "." };
  if (S.studio.cash < f.cost) return { err: "Need " + fm(f.cost) + " to win " + f.name + "." };
  spend(f.cost, "Premiere bid · " + f.name + " · " + p.title);
  M.premieres[pid] = f.name;
  p.buzz += f.buzz;
  S.studio.rep = clamp(S.studio.rep + f.rep, 0, 100);
  log("🎟️ “" + p.title + "” takes its world premiere to " + f.name + " (" + fm(f.cost) + ") — buzz +" + f.buzz + ", rep +" + f.rep + ".", "gold", "🎟️");
  toast("Premiere set: " + f.name + ".", "gold");
  return { ok: true, festival: f.name };
}

/* ── weekly tick (integrator wires tickMedia after advanceWeek) ── */
function tickMedia() {
  if (!S || S.over) return;
  medEnsure();
  var M = S.med, i, p, n;
  /* critic relationships drift one point toward neutral per week */
  for (i = 0; i < CRITICS.length; i++) {
    n = CRITICS[i].n;
    if (M.rel[n] > 0) M.rel[n] -= 1;
    else if (M.rel[n] < 0) M.rel[n] += 1;
  }
  /* ratings board: assign once when a project reaches ready */
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase === "ready" && !p.rating) {
      p.rating = medRatingFor(p.genre);
      if (p.rating === "R") {
        if (!S.pending) S.pending = { type: "appeal", projectId: p.id };
        log("📋 The ratings board slaps “" + p.title + "” with an R. Appeal or accept — the desk is open.", "bad", "📋");
      } else {
        log("📋 “" + p.title + "” is rated " + p.rating + " — no appeal needed.", "", "📋");
      }
    }
  }
}

/* ── commit + action delegation (ui calls mediaAction first) ──── */
function medCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function medHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  medCommit();
}
function mediaAction(a, elx) {
  var id = null, key = 0;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    key = +(elx.getAttribute("data-key") || 0);
  }
  if (a === "med-court") medHandle(medCourt(id));
  else if (a === "med-slam") medHandle(medSlam(id));
  else if (a === "med-trailer") medHandle(medTrailer(id));
  else if (a === "med-pass") medHandle(medPass(id));
  else if (a === "med-accept") medHandle(medAcceptR(id));
  else if (a === "med-appeal") medHandle(medAppealR(id));
  else if (a === "med-cut") medHandle(medCutPG(id));
  else if (a === "med-premiere") medHandle(medPremiere(id, key));
  else return false;
  return true;
}

/* ── desks (render returns sheet body HTML only) ──────────────── */
function medRelTag(rel) {
  if (rel >= 3) return tag("Warm +" + rel, "green");
  if (rel <= -3) return tag("Chilly " + rel, "red");
  if (rel > 0) return tag("+" + rel + " friendly", "");
  if (rel < 0) return tag(rel + " strained", "");
  return tag("Neutral", "");
}
function medDeskPress() {
  medEnsure();
  var M = S.med, st = S.studio, i, c, p;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Relationship add", "each critic's review score ±")
    + statrow("Drift", "all scores → 0 by 1/wk")
    + "</div>";
  /* critic rows: score bar + court/slam */
  for (i = 0; i < CRITICS.length; i++) {
    c = CRITICS[i];
    var rel = M.rel[c.n] || 0;
    var cdC = medCdLeft(c.n, "court"), cdS = medCdLeft(c.n, "slam");
    var pct = clamp(50 + rel * 5, 0, 100);
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + esc(c.n) + "</div>" + medRelTag(rel) + "</div>"
      + '<div class="bar' + (rel > 0 ? " green" : rel < 0 ? " red" : "") + '"><i style="width:' + pct + '%"></i></div>'
      + '<div class="foot btnrow">'
      + '<button class="btn primary sm" data-action="med-court" data-id="' + esc(c.n) + '"'
      + (cdC > 0 || st.cash < MED_COURT.cost ? " disabled" : "") + ">Court dinner · " + fm(MED_COURT.cost) + "</button>"
      + '<button class="btn danger sm" data-action="med-slam" data-id="' + esc(c.n) + '"'
      + (cdS > 0 ? " disabled" : "") + ">Slam publicly · free</button>"
      + (cdC > 0 ? '<span class="tag">court ' + cdC + "wk</span>" : "")
      + (cdS > 0 ? '<span class="tag">slam ' + cdS + "wk</span>" : "")
      + "</div></div>";
  }
  /* trailer market */
  var anyT = false;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.releaseWeek != null) anyT = true;
  }
  html += '<div class="sechead"><h2>Trailer market</h2></div>'
    + '<div class="card">'
    + statrow("Drop a trailer", fm(MED_TRAILER_COST) + " · one per project")
    + statrow("First-week views roll", "7.0M+ viral buzz+10 · 4.0M+ solid +6 · else +2")
    + "</div>";
  if (!anyT) html += '<div class="empty"><span class="em">🍿</span>No scheduled releases to sell. Trailers need a locked release date.</div>';
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.releaseWeek == null) continue;
    var has = M.trailers[p.id] != null;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag("Opens W" + woyOf(p.releaseWeek)) + "</div>"
      + '<div class="meta">' + tag("Buzz +" + p.buzz, p.buzz ? "blue" : "")
      + (has ? tag("Trailer out · " + M.trailers[p.id].toFixed(1) + "M views", M.trailers[p.id] >= 7 ? "gold" : "blue") : tag("Cash after " + fm(st.cash - MED_TRAILER_COST)))
      + "</div>"
      + '<div class="foot">';
    if (has) html += '<span class="tag">One trailer per project</span>';
    else html += '<button class="btn primary sm" data-action="med-trailer" data-id="' + esc(p.id) + '"'
      + (st.cash < MED_TRAILER_COST ? " disabled" : "") + ">Drop trailer · " + fm(MED_TRAILER_COST) + "</button>";
    html += "</div></div>";
  }
  /* script development passes */
  var anyP = false;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "pre" || S.projects[i].phase === "shoot") { anyP = true; break; }
  html += '<div class="sechead"><h2>Script development</h2></div>'
    + '<div class="card">'
    + statrow("Passes", "max 3 · " + fm(MED_PASS_COSTS[0]) + " → " + fm(MED_PASS_COSTS[1]) + " → " + fm(MED_PASS_COSTS[2]))
    + statrow("Each pass", "script +3–6, quality reads it at the cut")
    + "</div>";
  if (!anyP) html += '<div class="empty"><span class="em">📝</span>Nothing in pre-production or shoot to polish.</div>';
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase !== "pre" && p.phase !== "shoot") continue;
    var n = M.passes[p.id] || 0;
    var cost = n < MED_PASS_COSTS.length ? MED_PASS_COSTS[n] : null;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag(p.phase === "pre" ? "Pre" : "Shoot") + "</div>"
      + '<div class="meta">' + tag("Script " + p.script, "blue") + tag("Passes " + n + "/3", n ? "gold" : "");
    if (cost != null) html += tag("Cash after " + fm(st.cash - cost));
    html += "</div>"
      + '<div class="foot">';
    if (cost == null) html += '<span class="tag">Max passes reached</span>';
    else html += '<button class="btn primary sm" data-action="med-pass" data-id="' + esc(p.id) + '"'
      + (st.cash < cost ? " disabled" : "") + ">Script pass " + (n + 1) + " · " + fm(cost) + "</button>";
    html += "</div></div>";
  }
  return html;
}

function medDeskRatings() {
  medEnsure();
  var st = S.studio, i, p;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Board rule", "R at ready for horror/thriller · G animation/docs · PG comedy/romance")
    + statrow("Unappealed R", "aud −3 at release")
    + "</div>";
  var rated = [];
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase === "ready" && p.rating) {
      html += '<div class="card"><div class="statrow"><span class="k">' + genreOf(p.genre).em + " " + esc(p.title)
        + '</span><span class="v">' + tag(p.rating, p.rating === "R" ? "red" : "green")
        + (p.appealDone ? tag("Ruled", "gold") : p.rating === "R" ? tag("Appeal open", "blue") : "") + "</span></div></div>";
      if (p.rating === "R") rated.push(p);
    }
  }
  if (!rated.length) return html + '<div class="empty"><span class="em">📋</span>No R-rated releases awaiting a ruling. The board only tangles with horror and thrillers.</div>';
  for (i = 0; i < rated.length; i++) {
    p = rated[i];
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag("Rated R", "red") + "</div>"
      + '<div class="meta">'
      + tag("Accept: aud −3 · free")
      + tag("Appeal: 60% → PG-13 aud +4, else aud −2 · " + fm(1))
      + tag("Recut: quality −2, aud +4 · " + fm(2.5))
      + "</div>"
      + '<div class="foot btnrow">'
      + '<button class="btn sm" data-action="med-accept" data-id="' + esc(p.id) + '">Accept R</button>'
      + '<button class="btn primary sm" data-action="med-appeal" data-id="' + esc(p.id) + '"'
      + (st.cash < 1 ? " disabled" : "") + ">Appeal · " + fm(1) + "</button>"
      + '<button class="btn sm" data-action="med-cut" data-id="' + esc(p.id) + '"'
      + (st.cash < 2.5 ? " disabled" : "") + ">Cut for PG-13 · " + fm(2.5) + "</button>"
      + "</div></div>";
  }
  return html;
}

function medDeskPremiere() {
  medEnsure();
  var M = S.med, st = S.studio, woy = woyOf(st.week);
  var open = woy >= 34 && woy <= 38;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Auction window", open ? tag("Open · weeks 34–38", "green") : "weeks 34–38 · now W" + woy)
    + statrow("Bidding", "one premiere per project, ever")
    + "</div>";
  var list = [], i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if ((p.phase === "post" || p.phase === "ready") && MED_PRESTIGE.indexOf(p.genre) >= 0) list.push(p);
  }
  if (!list.length) return html + '<div class="empty"><span class="em">🎟️</span>No prestige projects (drama, crime, romance, docs, musical) in post or ready.</div>';
  for (i = 0; i < list.length; i++) {
    p = list[i];
    var done = M.premieres[p.id];
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag(p.phase === "ready" ? "Ready" : "Post") + "</div>"
      + '<div class="meta">' + tag("Buzz +" + p.buzz, p.buzz ? "blue" : "");
    if (done) html += tag("Premiered at " + done, "gold");
    else html += tag("Cash after · see bid") + tag("Bids: ★ rep / 📣 buzz");
    html += "</div>"
      + '<div class="foot btnrow">';
    if (done) html += '<span class="tag">The red carpet is spent</span>';
    else {
      for (var t = 0; t < MED_PREMIERES.length; t++) {
        var f = MED_PREMIERES[t];
        html += '<button class="btn primary sm" data-action="med-premiere" data-id="' + esc(p.id) + '" data-key="' + t + '"'
          + (!open || st.cash < f.cost ? " disabled" : "") + ">" + f.name + " · " + fm(f.cost) + " (★+" + f.rep + " 📣+" + f.buzz + ")</button>";
      }
    }
    html += "</div></div>";
  }
  return html;
}

var MEDIA_DESKS = [
  { id: "med-press", group: "Press", icon: "🎙️", name: "Press relationships",
    desc: "Court or slam the eight critics — their scores add into every review. Plus trailers and script passes.",
    render: medDeskPress },
  { id: "med-ratings", group: "Press", icon: "📋", name: "Ratings appeals",
    desc: "Accept an R, appeal it to the board, or recut for PG-13.",
    render: medDeskRatings },
  { id: "med-premiere", group: "Press", icon: "🎟️", name: "Premiere market",
    desc: "Bid one prestige project into Cannes, Sundance or Venice, weeks 34–38.",
    render: medDeskPremiere }
];
