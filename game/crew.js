/* Box Office War — rebuilt. Crew & production module (wave 6).
   Systems: weekly rotating crew pool (6 candidates, dp/editor/composer, tier 1–3),
   per-project hiring (one crew per role, fee paid, candidate booked 30 weeks),
   composer soundtrack deals (8 weekly earns after the film releases),
   on-location shoots (+3 craft via engine, weekly weather risk) and
   production-choice desk rows over the engine functions rushFilm/extendFilm/reshootScene.
   All state lives under S.crew (lazy crewEnsure()).
   Engine hooks defined here (typeof-guarded on the engine side):
   - crewMods(p) → {craft} add at computeQuality (LIVE, engine.js line ~312).
   - forecastAdjust_crew() → 0 (crew moves cash only at action/earn time).
   Integration note for the integrator (wiring NOT yet present in this tree):
   - engine.js advanceWeek needs `if (typeof tickCrew === "function") tickCrew();`
     and ui.js needs the usual crewAction bridge + CREW_DESKS concat — the module
     defines all three; the test harness calls tickCrew after advanceWeek.
   Interpretation notes: booked candidates stay on the pool board (so project
   references stay valid) until bookedUntil passes; hired snapshots are kept in
   S.crew.hired so crewMods survives pool rotation; composer tiers are snapshotted
   per project in S.crew.compOf because releaseFilm splices the project out of
   S.projects, so released films are matched back by title (ids in S.crew.seen). */
"use strict";

/* ── tuning ───────────────────────────────────────────────────── */
var CREW_ROLES = ["dp", "editor", "composer"];
var CREW_ROLE_NAMES = { dp: "DP", editor: "Editor", composer: "Composer" };
var CREW_CRAFT = { dp: [2, 3, 4], editor: [1, 2, 3], composer: [1, 2, 2] };
var CREW_FEE_MULT = { dp: 1.5, editor: 1, composer: 0.7 };
var CREW_POOL_SIZE = 6;
var CREW_BOOK_WEEKS = 30;
var CREW_LOCATION_COST = 1.5;
var CREW_ST_WEEKS = 8;
var CREW_ST_RATE = 0.3;

/* ── state ────────────────────────────────────────────────────── */
function crewEnsure() {
  if (!S.crew) S.crew = {};
  var M = S.crew;
  if (!M.pool) M.pool = [];
  if (!M.hired) M.hired = {};        /* candidateId → hired snapshot (craft survives rotation) */
  if (!M.compOf) M.compOf = {};      /* projectId → { tier, title } composer credit at hire */
  if (!M.seen) M.seen = {};          /* projectId / filmId → soundtrack deal already started */
  if (!M.soundtracks) M.soundtracks = []; /* { title, tier, left } active royalty streams */
  if (M.poolWk == null) crewRegen();
}

/* ── pool: 6 rotating candidates, booked ones hold their board slot ── */
function crewCand() {
  var role = pick(CREW_ROLES), tier = ri(1, 3);
  var fee = tier * CREW_FEE_MULT[role] * 2.4 + rf(0, 0.8);
  fee = Math.round(clamp(fee, 1, 8) * 10) / 10;
  return { id: "cw" + (S.seq++), n: genName(), role: role, tier: tier,
    craft: CREW_CRAFT[role][Math.min(tier, CREW_CRAFT[role].length) - 1],
    fee: fee, bookedUntil: 0 };
}
function crewRegen() {
  var M = S.crew, kept = [], i;
  if (M.poolWk === S.studio.week) return;
  for (i = 0; i < M.pool.length; i++) if (M.pool[i].bookedUntil > S.studio.week) kept.push(M.pool[i]);
  while (kept.length < CREW_POOL_SIZE) kept.push(crewCand());
  M.pool = kept;
  M.poolWk = S.studio.week;
}
function crewAvail(c) { return c.bookedUntil <= S.studio.week; }
function crewBest(role, n) {
  var list = [], i;
  for (i = 0; i < S.crew.pool.length; i++) {
    if (S.crew.pool[i].role === role && crewAvail(S.crew.pool[i])) list.push(S.crew.pool[i]);
  }
  list.sort(function (a, b) { return b.craft - a.craft || a.fee - b.fee; });
  return list.slice(0, n);
}

/* ── engine hook: hired crew craft for this project's roles ───── */
function crewMods(p) {
  if (!S || !S.crew || !p || !p.crewHired) return { craft: 0 };
  var total = 0, role, id, c;
  for (role in p.crewHired) {
    id = p.crewHired[role];
    c = S.crew.hired[id];
    if (c) total += c.craft;
  }
  return { craft: total };
}

/* ── mechanic 1: hire a crew candidate onto a project ─────────── */
function crewHire(pid, cid) {
  crewEnsure();
  var M = S.crew, p = findProject(pid), i, c = null;
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "pre" && p.phase !== "shoot") return { err: "Crew signs in pre-production or shoot." };
  for (i = 0; i < M.pool.length; i++) if (M.pool[i].id === cid) { c = M.pool[i]; break; }
  if (!c) return { err: "That crew member just rotated off the board." };
  if (!crewAvail(c)) return { err: c.n + " is booked until week " + c.bookedUntil + "." };
  if (p.crewHired && p.crewHired[c.role]) return { err: "“" + p.title + "” already has its " + CREW_ROLE_NAMES[c.role] + "." };
  if (S.studio.cash < c.fee) return { err: "Need " + fm(c.fee) + " free to sign " + c.n + "." };
  spend(c.fee, "Hire " + CREW_ROLE_NAMES[c.role] + " · " + c.n + " · " + p.title);
  p.crewHired = p.crewHired || {};
  p.crewHired[c.role] = c.id;
  M.hired[c.id] = { id: c.id, n: c.n, role: c.role, tier: c.tier, craft: c.craft };
  c.bookedUntil = S.studio.week + CREW_BOOK_WEEKS;
  if (c.role === "composer" && !M.compOf[p.id]) M.compOf[p.id] = { tier: c.tier, title: p.title };
  log("👥 " + c.n + " signs as " + CREW_ROLE_NAMES[c.role] + " on “" + p.title + "” — tier " + c.tier + ", craft +" + c.craft + " (" + fm(c.fee) + ").", "good", "👥");
  toast(CREW_ROLE_NAMES[c.role] + " " + c.n + " hired · crew craft +" + crewMods(p).craft + ".", "good");
  return { ok: true, craft: c.craft };
}

/* ── mechanic 5: shoot on location ($1.5M, once, engine +3 craft) ── */
function crewLocation(pid) {
  crewEnsure();
  var p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (p.phase !== "pre" && p.phase !== "shoot") return { err: "Location shoots lock in pre-production or shoot." };
  if (p.locationShoot) return { err: "“" + p.title + "” already shoots on location." };
  if (S.studio.cash < CREW_LOCATION_COST) return { err: "Need " + fm(CREW_LOCATION_COST) + " to move the shoot on location." };
  spend(CREW_LOCATION_COST, "Shoot on location · " + p.title);
  p.locationShoot = true;
  log("⛰️ “" + p.title + "” moves on location — tougher shoot, better film (+3 craft). Weather watch is on.", "good", "⛰️");
  toast("“" + p.title + "” shoots on location (+3 craft).", "good");
  return { ok: true };
}

/* ── mechanic 4: production choices → engine functions ────────── */
function crewChoice(pid, kind) {
  var p = findProject(pid), ok = false;
  if (!p) return { err: "That project is gone." };
  if (kind === "rush") ok = rushFilm(pid);
  else if (kind === "extend") ok = extendFilm(pid);
  else ok = reshootScene(pid);
  if (!ok) return { err: "Not possible — needs the shoot phase, free cash and no prior take." };
  return { ok: true };
}

/* ── weekly tick (engine wires tickCrew after its own systems) ── */
function tickCrew() {
  if (!S || S.over) return;
  crewEnsure();
  var M = S.crew, i, f, pid, p;
  crewRegen();
  /* composer soundtrack royalties: 8 weekly earns per released film */
  for (i = M.soundtracks.length - 1; i >= 0; i--) {
    var st = M.soundtracks[i];
    earn(st.tier * CREW_ST_RATE, "Soundtrack · " + st.title);
    st.left -= 1;
    if (st.left <= 0) M.soundtracks.splice(i, 1);
  }
  /* a film with a hired composer releases → soundtrack deal starts next week */
  for (pid in M.compOf) {
    if (M.seen[pid]) continue;
    for (i = 0; i < S.films.length; i++) {
      f = S.films[i];
      if (M.seen[f.id]) continue;
      if (f.title === M.compOf[pid].title) {
        M.seen[pid] = true;
        M.seen[f.id] = true;
        M.soundtracks.push({ title: f.title, tier: M.compOf[pid].tier, left: CREW_ST_WEEKS });
        log("🎵 The “" + f.title + "” score lands a soundtrack deal — " + fm(M.compOf[pid].tier * CREW_ST_RATE) + "/wk for " + CREW_ST_WEEKS + " weeks.", "gold", "🎵");
        break;
      }
    }
  }
  /* weather risk on location shoots */
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.locationShoot && p.phase === "shoot" && !p.weatherHit && chance(0.1)) {
      p.weatherHit = true;
      p.phaseLen.shoot += 1;
      spend(p.budget * 0.03, "Weather delay · " + p.title);
      log("🌧️ Weather delay on the location shoot of “" + p.title + "” — one week lost, " + fm(p.budget * 0.03) + " damage.", "bad", "🌧️");
    }
  }
}

/* ── engine hook: no weekly recurring cash of its own ─────────── */
function forecastAdjust_crew() { return 0; }

/* ── commit + action delegation (ui calls crewAction first) ───── */
function crewCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function crewHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  crewCommit();
}
function crewAction(a, elx) {
  var pid = null, cid = null;
  if (elx && elx.getAttribute) {
    pid = elx.getAttribute("data-id");
    cid = elx.getAttribute("data-key");
  }
  if (a === "crew-hire") crewHandle(crewHire(pid, cid));
  else if (a === "crew-location") crewHandle(crewLocation(pid));
  else if (a === "crew-rush") crewHandle(crewChoice(pid, "rush"));
  else if (a === "crew-extend") crewHandle(crewChoice(pid, "extend"));
  else if (a === "crew-reshoot") crewHandle(crewChoice(pid, "reshoot"));
  else return false;
  return true;
}

/* ── desk (render returns sheet body HTML only) ───────────────── */
function crewHireButtons(p, role) {
  var st = S.studio, best = crewBest(role, 3), i, b, html = "";
  if (!best.length) return '<span class="tag">No ' + CREW_ROLE_NAMES[role] + " on the board this week</span>";
  if (p.crewHired && p.crewHired[role]) {
    var c = S.crew.hired[p.crewHired[role]];
    return '<span class="tag green">' + CREW_ROLE_NAMES[role] + ": " + esc(c ? c.n : "signed") + (c ? " · T" + c.tier + " craft +" + c.craft : "") + "</span>";
  }
  for (i = 0; i < best.length; i++) {
    b = best[i];
    html += '<button class="btn sm" data-action="crew-hire" data-id="' + esc(p.id) + '" data-key="' + esc(b.id) + '"'
      + (st.cash < b.fee ? " disabled" : "") + ">" + esc(b.n) + " · T" + b.tier + " c" + b.craft + " · " + fm(b.fee) + "</button>";
  }
  return html;
}
function crewProjectModsTags(p) {
  var mods = crewMods(p), tags = "";
  if (mods.craft > 0) tags += tag("Crew craft +" + mods.craft, "blue");
  if (p.locationShoot) tags += tag("On location", "blue");
  if (p.weatherHit) tags += tag("Weather hit", "red");
  if (p.rushed) tags += tag("Rushed", "");
  if (p.extended) tags += tag("Extended takes", "");
  if (p.reshotScene) tags += tag("Reshot", "");
  return tags;
}
function crewDeskMain() {
  crewEnsure();
  var M = S.crew, st = S.studio, i, p, r;
  var stWk = 0, stCash = 0;
  for (i = 0; i < M.soundtracks.length; i++) { stWk++; stCash += M.soundtracks[i].tier * CREW_ST_RATE; }
  var html = '<div class="card">'
    + statrow("Cash on hand", fm(st.cash))
    + statrow("Crew pool", CREW_POOL_SIZE + " candidates · rotates weekly")
    + statrow("Crew craft", "DP +2–4 · editor +1–3 · composer +1–2, at the cut")
    + statrow("Soundtracks", stWk ? stWk + " active · " + fm(stCash) + "/wk · " + CREW_ST_WEEKS + " wks each" : "none yet")
    + "</div>";
  var any = false;
  for (i = 0; i < S.projects.length; i++) if (S.projects[i].phase === "pre" || S.projects[i].phase === "shoot") { any = true; break; }
  if (!any) return html + '<div class="empty"><span class="em">👥</span>Nothing in pre-production or shoot — crew signs and choices open once a project is moving.</div>';
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (p.phase !== "pre" && p.phase !== "shoot") continue;
    html += '<div class="card film">'
      + '<div class="head"><div class="title">' + genreOf(p.genre).em + " " + esc(p.title) + "</div>" + tag(p.phase === "pre" ? "Pre" : "Shoot") + "</div>"
      + '<div class="meta">' + crewProjectModsTags(p) + tag("Cash " + fm(st.cash)) + "</div>";
    for (r = 0; r < CREW_ROLES.length; r++) {
      html += '<div class="statrow"><span class="k">' + CREW_ROLE_NAMES[CREW_ROLES[r]] + '</span><span class="v">'
        + crewHireButtons(p, CREW_ROLES[r]) + "</span></div>";
    }
    html += '<div class="foot btnrow">';
    if (!p.locationShoot) {
      html += '<button class="btn sm" data-action="crew-location" data-id="' + esc(p.id) + '"'
        + (st.cash < CREW_LOCATION_COST ? " disabled" : "") + ">Shoot on location · " + fm(CREW_LOCATION_COST) + "</button>";
    } else {
      html += '<span class="tag">On location · weather risk 10%/wk</span>';
    }
    if (p.phase === "shoot") {
      if (!p.rushed) html += '<button class="btn sm" data-action="crew-rush" data-id="' + esc(p.id) + '"'
        + (st.cash < p.budget * 0.12 ? " disabled" : "") + ">Rush · " + fm(p.budget * 0.12) + " (−1 wk)</button>";
      if (!p.extended) html += '<button class="btn primary sm" data-action="crew-extend" data-id="' + esc(p.id) + '"'
        + (st.cash < p.budget * 0.05 ? " disabled" : "") + ">Extend · " + fm(p.budget * 0.05) + " (+3 craft)</button>";
      if (!p.reshotScene) html += '<button class="btn sm" data-action="crew-reshoot" data-id="' + esc(p.id) + '"'
        + (st.cash < p.budget * 0.06 ? " disabled" : "") + ">Reshoot a scene · " + fm(p.budget * 0.06) + " (+2 craft)</button>";
    }
    html += "</div></div>";
  }
  return html;
}

var CREW_DESKS = [
  { id: "crew-main", group: "Crew", icon: "👥", name: "Crew & production",
    desc: "Hire a DP, editor and composer per project, shoot on location, and rush, extend or reshoot while filming.",
    render: crewDeskMain }
];
