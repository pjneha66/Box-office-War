/* Box Office War — rebuilt. Creativity & demographics module (wave 3).
   Systems: camera/lens packages, director sparks, the writers' room, the script
   doctor, quadrant demographics & audience ratings, dial tests, the remake vault.
   All state lives under S.cre (lazy creEnsure()).
   Engine hook defined here (typeof-guarded on the engine side, wave-3 addendum):
   - creativeProjectMods(project) → { craft, aud, legs } — engine adds these in
     computeQuality() (craft) and releaseFilm() (aud, legs).
   Timing note: engine computeQuality() runs once, when a project wraps (post → ready),
   so craft from camera/spark/wroom/doctor/remake reaches the film only if in place by
   then. A doctor pass bought after wrap applies its +10 straight to the locked quality. */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var CRE_CAMS = [
  { id: "arri", name: "Arri Digital",    cost: 0.15, craft: 3, aud: 0 },
  { id: "ana",  name: "35mm Anamorphic", cost: 0.6,  craft: 6, aud: 0 },
  { id: "imax", name: "70mm IMAX-cam",   cost: 1.8,  craft: 9, aud: 0 },
  { id: "v16",  name: "Vintage 16mm",    cost: 0.35, craft: 4, aud: 2 }
];
var CRE_SPARK_NAMES = ["One-take sequence", "Practical effects day", "Improvised dialogue",
  "Rain-soaked night shoot", "Long-lens chase", "Real-location finale",
  "Handheld confessional", "Practical fire stunt"];
var CRE_WROOM_MAX = 5;
var CRE_WROOM_STEP = 1.5;   /* craft per writers' room tier */
var CRE_DOCTOR_COST = 1.5;
var CRE_DIAL_COST = 0.35;
var CRE_REMAKE_COST = 40;
var CRE_REMAKE_MIN_WW = 60;
var CRE_FAMILY_GENRES = ["animation", "comedy"];
var CRE_QUADS = [
  { id: "kids",   name: "Kids",         share: 0.22, favs: ["animation", "fantasy", "comedy"] },
  { id: "teens",  name: "Teens",        share: 0.28, favs: ["horror", "scifi", "action"] },
  { id: "ya",     name: "Young adults", share: 0.32, favs: ["action", "romance", "thriller", "scifi"] },
  { id: "mature", name: "Mature",       share: 0.18, favs: ["drama", "crime", "docs", "musical"] }
];

/* ── state ────────────────────────────────────────────────────── */
function creEnsure() {
  if (!S.cre) S.cre = {};
  var C = S.cre;
  if (!C.wroom) C.wroom = 0;     /* writers' room tier 0..5 */
  if (!C.sparks) C.sparks = {};  /* projectId → { opts: [3 named offers], done } */
  if (!C.dial) C.dial = {};      /* projectId → { curve: [6 scores], sag } */
  if (!C.doctor) C.doctor = {};  /* projectId → true once doctored */
  if (!C.camera) C.camera = {};  /* projectId → camera id (p.cameraFmt mirrors it) */
}
/* engine spend() rounds to one decimal — charge and display through the same helper */
function creCharge(x) { return Math.round(x * 10) / 10; }

/* ── demographics ─────────────────────────────────────────────── */
function creRatingOf(genre) {
  if (genre === "horror" || genre === "thriller") return "R";
  if (genre === "animation" || genre === "docs") return "G";
  if (genre === "comedy" || genre === "romance") return "PG";
  return "PG-13";
}
function creSharesOf(genre) {
  var r = creRatingOf(genre), out = [], i, q;
  for (i = 0; i < CRE_QUADS.length; i++) {
    q = CRE_QUADS[i];
    out.push({ id: q.id, name: q.name, share: (r === "R" && q.id === "kids") ? 0 : q.share, fav: q.favs.indexOf(genre) >= 0 });
  }
  return out;
}
function creAudMod(genre) {
  var i, favored = [], top = CRE_QUADS.slice().sort(function (a, b) { return b.share - a.share; }).slice(0, 2);
  for (i = 0; i < CRE_QUADS.length; i++) if (CRE_QUADS[i].favs.indexOf(genre) >= 0) favored.push(CRE_QUADS[i].id);
  if (top[0].favs.indexOf(genre) >= 0 && top[1].favs.indexOf(genre) >= 0) return 4;
  if (favored.length === 1 && favored[0] === "mature") return -3;
  return 0;
}
function creLegsMod(genre) { return CRE_FAMILY_GENRES.indexOf(genre) >= 0 ? 0.05 : 0; }

/* ── engine hook: {craft, aud, legs} additions ────────────────── */
function creativeProjectMods(p) {
  creEnsure();
  var craft = (S.cre.wroom || 0) * CRE_WROOM_STEP, aud = 0, legs = 0, i, cam = null;
  if (p.cameraFmt) {
    for (i = 0; i < CRE_CAMS.length; i++) if (CRE_CAMS[i].id === p.cameraFmt) cam = CRE_CAMS[i];
    if (cam) { craft += cam.craft; aud += cam.aud || 0; }
  }
  if (p.spark && p.spark.craft) craft += p.spark.craft;
  if (p.doctored) craft += 10;
  if (p.remakeOf) craft += 3;
  aud += creAudMod(p.genre);
  legs += creLegsMod(p.genre);
  return { craft: craft, aud: aud, legs: legs };
}

/* ── weekly tick (engine calls tickCreative() after its own systems) ── */
function tickCreative() {
  if (!S || S.over) return;
  creEnsure();
  var i, p;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (!p.rating) p.rating = creRatingOf(p.genre); /* audience rating locked at first sight */
    if ((p.phase === "shoot" || p.phase === "post") && !S.cre.sparks[p.id]) {
      S.cre.sparks[p.id] = { opts: creRollSparks(), done: false };
    }
  }
}
function creRollSparks() {
  var bank = CRE_SPARK_NAMES.slice(), out = [], i, ix;
  for (i = 0; i < 3 && bank.length; i++) {
    ix = Math.floor(Math.random() * bank.length);
    out.push({ name: bank.splice(ix, 1)[0], cost: Math.round(rf(0.3, 1.2) * 10) / 10, craft: ri(6, 12) });
  }
  return out;
}

/* ── mechanic 1: camera / lens packages (shoot phase, once) ───── */
function creCamName(id) {
  var i;
  for (i = 0; i < CRE_CAMS.length; i++) if (CRE_CAMS[i].id === id) return CRE_CAMS[i].name;
  return id;
}
function creCamBuy(pid, fmtIdx) {
  creEnsure();
  var p = findProject(pid), cam = CRE_CAMS[fmtIdx];
  if (!p) return { err: "That project is gone." };
  if (!cam) return { err: "Pick a camera package." };
  if (p.phase !== "shoot") return { err: "Camera packages are chosen in shoot only." };
  if (p.cameraFmt) return { err: "“" + p.title + "” already shoots on " + creCamName(p.cameraFmt) + "." };
  var cost = creCharge(cam.cost);
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " free for the " + cam.name + " package." };
  spend(cost, "Camera package · " + p.title);
  p.cameraFmt = cam.id;
  S.cre.camera[pid] = cam.id;
  log("“" + p.title + "” rolls on " + cam.name + " (" + fm(cost) + ") — craft +" + cam.craft + (cam.aud ? ", audience +" + cam.aud : "") + ".", "", "🎥");
  toast(cam.name + " locked for “" + p.title + "”.", "good");
  return { ok: true };
}

/* ── mechanic 2: director sparks (shoot/post, buy one ever) ───── */
function creSparkBuy(pid, idx) {
  creEnsure();
  var p = findProject(pid), offer = S.cre.sparks[pid], s = (offer && offer.opts) ? offer.opts[idx] : null;
  if (!p) return { err: "That project is gone." };
  if (!offer || !offer.opts || !offer.opts.length) return { err: "No sparks on the board for this project." };
  if (offer.done || p.spark) return { err: "One director spark per project." };
  if (!s) return { err: "Pick a spark." };
  if (p.phase !== "shoot" && p.phase !== "post") return { err: "Sparks only surface during shoot or post." };
  var cost = creCharge(s.cost);
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " free for “" + s.name + "”." };
  spend(cost, "Director spark · " + p.title);
  p.spark = { name: s.name, craft: s.craft };
  offer.done = true;
  log("Director spark on “" + p.title + "”: " + s.name + " (" + fm(cost) + ") — craft +" + s.craft + ".", "good", "✨");
  toast("“" + s.name + "” is in the cut.", "good");
  return { ok: true, craft: s.craft };
}

/* ── mechanic 3: writers' room (studio upgrade T1–T5) ─────────── */
function creWroomCost() { return creCharge(CRE_WROOM_STEP * ((S.cre ? S.cre.wroom : 0) + 1)); }
function creWroomUp() {
  creEnsure();
  if (S.cre.wroom >= CRE_WROOM_MAX) return { err: "The writers' room is fully staffed (T" + CRE_WROOM_MAX + ")." };
  var cost = creWroomCost();
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " free to expand the writers' room." };
  spend(cost, "Writers' room T" + (S.cre.wroom + 1));
  S.cre.wroom++;
  log("Writers' room upgraded to T" + S.cre.wroom + " — every project now gets +" + (S.cre.wroom * CRE_WROOM_STEP) + " craft.", "good", "✍️");
  toast("Writers' room T" + S.cre.wroom + ".", "good");
  return { ok: true, tier: S.cre.wroom };
}

/* ── mechanic 4: script doctor (post/ready, once) ─────────────── */
function creDoctor(pid) {
  creEnsure();
  var p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "post" && p.phase !== "ready") return { err: "The script doctor works on a cut (post) or a locked film (ready)." };
  if (p.doctored || S.cre.doctor[pid]) return { err: "One doctor pass per project." };
  if (S.studio.cash < CRE_DOCTOR_COST) return { err: "Need " + fm(CRE_DOCTOR_COST) + " for the doctor." };
  spend(CRE_DOCTOR_COST, "Script doctor · " + p.title);
  p.doctored = true;
  S.cre.doctor[pid] = true;
  if (p.phase === "ready") {
    /* quality was locked at wrap — apply the craft delta directly */
    p.quality = clamp(p.quality + 10, 5, 98);
    log("Script doctor reworks “" + p.title + "” after lock (" + fm(CRE_DOCTOR_COST) + ") — quality +10.", "good", "🩺");
  } else {
    log("Script doctor moves into the edit of “" + p.title + "” (" + fm(CRE_DOCTOR_COST) + ") — craft +10 at wrap.", "", "🩺");
  }
  toast("Script doctor on “" + p.title + "”.", "good");
  return { ok: true };
}

/* ── mechanic 6: dial test (post, once) ───────────────────────── */
function creDialCurve(q) {
  var c = [], i;
  for (i = 0; i < 6; i++) c.push(clamp(Math.round(q + gauss() * 4 - i * 0.8), 5, 99));
  return c;
}
function creDialTest(pid) {
  creEnsure();
  var p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "post") return { err: "Dial tests run during post-production." };
  if (S.cre.dial[pid]) return { err: "One dial test per project." };
  var cost = creCharge(CRE_DIAL_COST);
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for the dial test." };
  spend(cost, "Dial test · " + p.title);
  var curve = creDialCurve(p.qPreview || 60);
  S.cre.dial[pid] = { curve: curve, sag: curve[4] < curve[2] - 6 };
  var d = S.cre.dial[pid];
  log("Dial test on “" + p.title + "”: minute curve " + curve.join("/") + (d.sag ? " — the third act sags." : " — it holds to the end."), d.sag ? "bad" : "good", "🧪");
  toast(d.sag ? "Third-act sag on “" + p.title + "”." : "“" + p.title + "” plays all the way through.", d.sag ? "bad" : "good");
  return { ok: true, sag: d.sag, curve: curve };
}

/* ── mechanic 7: remake vault ($40M, done films at $60M+ ww) ──── */
function creIdleTalent(kind) {
  var i, t, best = null;
  for (i = 0; i < S.market.length; i++) {
    t = S.market[i];
    if (t.k !== kind || talentBusy(t)) continue;
    if (!best || t.skill > best.skill) best = t;
  }
  return best;
}
function creRemake(filmId) {
  creEnsure();
  var f = findFilm(filmId);
  if (!f) return { err: "That film is not in the ledger." };
  if (f.status !== "done") return { err: "“" + f.title + "” is still playing — the vault remakes finished runs." };
  if (!((f.ww || 0) >= CRE_REMAKE_MIN_WW)) return { err: "“" + f.title + "” grossed " + fm(f.ww || 0) + " — the vault wants $60M+ worldwide." };
  if (S.studio.cash < CRE_REMAKE_COST) return { err: "Need " + fm(CRE_REMAKE_COST) + " to option the remake rights." };
  var dir = creIdleTalent("dir"), act = creIdleTalent("actor");
  if (!dir || !act) return { err: "No free director and lead in the talent market." };
  spend(CRE_REMAKE_COST, "Remake rights · " + f.title);
  dir.bookedUntil = S.studio.week + 40;
  act.bookedUntil = S.studio.week + 40;
  var sc = scaleOf(f.scale), budget = sc.budgets[1];
  var p = {
    id: "p" + (S.seq++),
    title: f.title + " (Remake)", genre: f.genre, scale: sc.id,
    budget: budget, budgetNow: budget,
    script: 75,
    dirId: dir.id, actId: act.id, dirFee: feeFor(dir, budget), actFee: feeFor(act, budget),
    scriptCost: 0,
    mktIdx: 1, mkt: null, releaseWeek: null,
    phase: "pre", phaseWk: 0,
    phaseLen: { pre: ri(sc.pre[0], sc.pre[1]), shoot: ri(sc.shoot[0], sc.shoot[1]), post: ri(sc.post[0], sc.post[1]) },
    overrun: 0, scandal: false, buzz: 12,
    remakeOf: f.title, franchiseOf: f.title,
    theme: null, packaged: false,
    prodScore: 55 + S.upg.post * 3 + Math.min((S.lot.crew || 0) * 1.2 + (S.lot.vfx || 0) * 1.6, 12)
  };
  S.projects.push(p);
  log("Remake vault: “" + p.title + "” greenlit for " + fm(budget) + " — +35% nostalgia, franchise recognition built in.", "gold", "🗄️");
  toast("“" + p.title + "” is in development.", "good");
  return { ok: true, projectId: p.id };
}

/* ── commit + action delegation (ui calls creativeAction first) ─ */
function creCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function creHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  creCommit();
}
function creativeAction(a, elx) {
  var id = null, key = 0;
  if (elx && elx.getAttribute) {
    id = elx.getAttribute("data-id");
    key = +(elx.getAttribute("data-key") || 0);
  }
  if (a === "cre-cam") creHandle(creCamBuy(id, key));
  else if (a === "cre-spark") creHandle(creSparkBuy(id, key));
  else if (a === "cre-wroom") creHandle(creWroomUp());
  else if (a === "cre-doctor") creHandle(creDoctor(id));
  else if (a === "cre-dial") creHandle(creDialTest(id));
  else if (a === "cre-remake") creHandle(creRemake(id));
  else return false;
  return true;
}

/* ── desks (render returns sheet body HTML only) ──────────────── */
function creByPhase(phases) {
  var out = [], i;
  for (i = 0; i < S.projects.length; i++) if (phases.indexOf(S.projects[i].phase) >= 0) out.push(S.projects[i]);
  return out;
}

function creDeskCam() {
  creEnsure();
  var st = S.studio, C = S.cre, i, p, t;
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Camera package", "one per project · locks at shoot")
    + statrow("Director spark", "one per project · shoot or post")
    + "</div>";
  var shoot = creByPhase(["shoot"]);
  html += '<div class="sechead"><h2>Camera packages</h2></div>';
  if (!shoot.length) html += '<div class="empty"><span class="em">🎥</span>Nothing is shooting. A package is chosen once, when production starts.</div>';
  for (i = 0; i < shoot.length; i++) {
    p = shoot[i];
    html += '<div class="card film"><div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag("Shoot") + "</div>";
    if (p.cameraFmt) {
      html += '<div class="meta">' + tag("Shooting on " + creCamName(p.cameraFmt), "blue") + "</div>";
    } else {
      for (t = 0; t < CRE_CAMS.length; t++) {
        html += '<div class="statrow"><span class="k">' + CRE_CAMS[t].name + " · +" + CRE_CAMS[t].craft + " craft"
          + (CRE_CAMS[t].aud ? " · +" + CRE_CAMS[t].aud + " aud" : "") + " — " + fm(creCharge(CRE_CAMS[t].cost)) + "</span>"
          + '<button class="btn sm" data-action="cre-cam" data-id="' + p.id + '" data-key="' + t + '"'
          + (st.cash < creCharge(CRE_CAMS[t].cost) ? " disabled" : "") + ">Equip</button></div>";
      }
    }
    html += "</div>";
  }
  var crew = creByPhase(["shoot", "post"]);
  html += '<div class="sechead"><h2>Director sparks</h2></div>';
  if (!crew.length) html += '<div class="empty"><span class="em">✨</span>No project in shoot or post. Sparks surface while a film is being made.</div>';
  for (i = 0; i < crew.length; i++) {
    p = crew[i];
    var offer = C.sparks[p.id];
    html += '<div class="card film"><div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag(p.phase === "shoot" ? "Shoot" : "Post") + "</div>";
    if (p.spark) {
      html += '<div class="meta">' + tag("Spark: " + esc(p.spark.name) + " (+" + p.spark.craft + " craft)", "gold") + "</div>";
    } else if (!offer || !offer.opts || !offer.opts.length) {
      html += '<div class="meta">' + tag("Sparks roll in on the next week tick") + "</div>";
    } else {
      for (t = 0; t < offer.opts.length; t++) {
        html += '<div class="statrow"><span class="k">' + esc(offer.opts[t].name) + " · +" + offer.opts[t].craft + " craft — " + fm(creCharge(offer.opts[t].cost)) + "</span>"
          + '<button class="btn sm" data-action="cre-spark" data-id="' + p.id + '" data-key="' + t + '"'
          + (st.cash < creCharge(offer.opts[t].cost) ? " disabled" : "") + ">Buy</button></div>";
      }
      html += '<div class="meta">' + tag("One spark per project — pick the one you want on screen") + "</div>";
    }
    html += "</div>";
  }
  return html;
}

function creDeskRoom() {
  creEnsure();
  var st = S.studio, wr = S.cre.wroom, i, f;
  var maxed = wr >= CRE_WROOM_MAX, cost = creWroomCost();
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Writers' room", tag("T" + wr + " / T" + CRE_WROOM_MAX, wr ? "green" : ""))
    + statrow("Craft bonus", "+" + (wr * CRE_WROOM_STEP) + " on every project")
    + "</div>"
    + '<div class="card"><div class="foot btnrow">';
  if (maxed) html += '<span class="tag gold">Fully staffed — T' + CRE_WROOM_MAX + "</span>";
  else html += '<button class="btn primary sm" data-action="cre-wroom"' + (st.cash < cost ? " disabled" : "") + ">Upgrade to T" + (wr + 1) + " · " + fm(cost) + "</button>"
    + '<span class="tag">cash after ' + fm(st.cash - cost) + "</span>";
  html += "</div></div>";
  html += '<div class="sechead"><h2>Remake vault</h2></div>';
  html += '<div class="card">'
    + statrow("Option fee", fm(CRE_REMAKE_COST) + " per remake")
    + statrow("Eligible", "finished runs at $60M+ worldwide")
    + statrow("What you get", "script 75 · buzz 12 · franchise opening")
    + "</div>";
  var vault = [];
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status === "done" && (f.ww || 0) >= CRE_REMAKE_MIN_WW) vault.push(f);
  }
  if (!vault.length) return html + '<div class="empty"><span class="em">🗄️</span>No finished run has crossed $60M worldwide yet. A beloved hit comes back cheaper than a new idea.</div>';
  for (i = 0; i < vault.length; i++) {
    f = vault[i];
    html += '<div class="card film"><div class="head"><div class="title">' + genreOf(f.genre).em + " " + esc(f.title) + "</div>"
      + tag(fm(f.ww) + " ww", "gold") + "</div>"
      + '<div class="meta">' + tag("Remake craft +3 · nostalgia opening", "blue") + tag("Cash after " + fm(st.cash - CRE_REMAKE_COST)) + "</div>"
      + '<div class="foot"><button class="btn primary sm" data-action="cre-remake" data-id="' + f.id + '"'
      + (st.cash < CRE_REMAKE_COST ? " disabled" : "") + ">Option remake · " + fm(CRE_REMAKE_COST) + "</button></div></div>";
  }
  return html;
}

function creDeskDemo() {
  creEnsure();
  var st = S.studio, i, s, m;
  var html = '<div class="card">' + statrow("Cash on hand", fm(st.cash)) + statrow("Audience quadrants", "shares of your opening audience") + "</div>";
  html += '<div class="card">';
  for (i = 0; i < CRE_QUADS.length; i++) {
    html += statrow(CRE_QUADS[i].name + " " + Math.round(CRE_QUADS[i].share * 100) + "%", esc(CRE_QUADS[i].favs.join(", ")));
  }
  html += statrow("R-rated films", "Kids share drops to 0%") + "</div>";
  var slate = creByPhase(["pre", "shoot", "post", "ready"]);
  html += '<div class="sechead"><h2>Slate & dial tests</h2></div>';
  if (!slate.length) return html + '<div class="empty"><span class="em">🧪</span>No active projects. Dial tests read a cut while it is still in post.</div>';
  for (i = 0; i < slate.length; i++) {
    var p = slate[i];
    var rating = p.rating || creRatingOf(p.genre);
    var shares = creSharesOf(p.genre);
    var audMod = creAudMod(p.genre);
    html += '<div class="card film"><div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>"
      + tag(rating, rating === "R" ? "red" : "green") + tag(p.phase) + "</div>";
    html += '<div class="meta">';
    for (s = 0; s < shares.length; s++) {
      html += tag(shares[s].name + " " + Math.round(shares[s].share * 100) + "%", shares[s].share === 0 ? "red" : (shares[s].fav ? "gold" : ""));
    }
    html += tag(audMod > 0 ? "Audience +" + audMod : (audMod < 0 ? "Audience " + audMod : "Audience ±0"), audMod > 0 ? "green" : (audMod < 0 ? "red" : ""));
    if (creLegsMod(p.genre)) html += tag("Legs +0.05 · family draw", "blue");
    html += "</div>";
    var d = S.cre.dial[p.id];
    if (d && d.curve) {
      html += '<div class="chart">';
      for (m = 0; m < d.curve.length; m++) {
        var v = d.curve[m];
        html += '<div class="c' + (v >= 60 ? " win" : "") + '"><i style="height:' + clamp(Math.round(v), 4, 100) + '%"></i><span>M' + (m + 1) + " · " + v + "</span></div>";
      }
      html += "</div>";
      html += '<div class="meta">' + (d.sag
        ? tag("⚠️ Third-act sag — book reshoots (Test screenings desk)", "red")
        : tag("Minute curve holds", "green")) + "</div>";
    }
    html += '<div class="foot btnrow">';
    if (p.phase === "post" && !d) {
      html += '<button class="btn sm" data-action="cre-dial" data-id="' + p.id + '"'
        + (st.cash < creCharge(CRE_DIAL_COST) ? " disabled" : "") + ">Dial test · " + fm(creCharge(CRE_DIAL_COST)) + "</button>";
    }
    if ((p.phase === "post" || p.phase === "ready") && !p.doctored && !S.cre.doctor[p.id]) {
      html += '<button class="btn primary sm" data-action="cre-doctor" data-id="' + p.id + '"'
        + (st.cash < CRE_DOCTOR_COST ? " disabled" : "") + ">Script doctor · " + fm(CRE_DOCTOR_COST) + "</button>";
    }
    if (p.doctored) html += '<span class="tag gold">Doctored · craft +10</span>';
    if (d) html += '<span class="tag">dial test done</span>';
    else if (p.phase !== "post") html += '<span class="tag">dial test runs in post</span>';
    html += "</div></div>";
  }
  return html;
}

var CREATIVE_DESKS = [
  { id: "cre-cam", group: "Creative", icon: "🎥", name: "Camera & sparks",
    desc: "Lock a camera package in shoot and buy a director spark — craft you can feel on screen.", render: creDeskCam },
  { id: "cre-room", group: "Creative", icon: "✍️", name: "Writers room & remakes",
    desc: "Staff the writers' room for a permanent craft bonus, and option finished hits for remake.", render: creDeskRoom },
  { id: "cre-demo", group: "Creative", icon: "🧪", name: "Demographics & dial tests",
    desc: "Who each film pulls, its audience rating, and the minute curve that flags a sagging third act.", render: creDeskDemo }
];
