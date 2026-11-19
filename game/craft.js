/* Box Office War — rebuilt. Craft departments module (v46 hook spec, module 3).
   Four BELOW-THE-LINE departments — cinematography, production design, sound mix,
   pre-viz. These are deliberately NOT the crew.js roles (DP / editor / composer):
   crew.js signs people onto a single film and returns {craft}; this module keeps a
   standing department head on a weekly retainer and lends that department to one
   project at a time. Nothing here double-counts a crew role.

   Systems:
   1. Staffing — each department has a rotating board of 3 candidates (tier 1-3).
      One head per department. Hiring pays a signing fee (retainer x3); replacing a
      head pays the fee again and stands the old head down. Release pays a
      severance (retainer x1.5).
   2. Retainers — every seated head is paid every week from spend(), so the
      department is a real recurring cost, not a one-off buff.
   3. Assignment — a head joins a project in pre / shoot / post for a fee
      (retainer x2). One project per department, one department per project. The
      effect is scoped to that project only: craftDeptMods(p) reads
      S.craft.assign[p.id] and returns zeros for every other project.
   4. Freshness — a head's attention decays 5%/week from 100 down to a 55% floor
      while the assignment is live (craftFresh), so a long pre-production dilutes
      the department's lift before the film is graded.
   5. Morale + contracts — idle departments lose morale and a head at rock bottom
      may walk; 26-week contracts renew automatically (retainer +8%) while the
      studio can afford them.

   Engine hooks defined here (typeof-guarded on the engine side):
     craftDeptMods(p)  -> { craft, aud, legs }   craft at computeQuality, aud/legs at release
     craftCriticAdj(p) -> number               small critic add (sound mix + colour grade)

   INTEGRATION STATUS in this tree (v46):
   - LIVE: engine.js advanceWeek calls tickCraft(); ui.js bridges craftAction() and
     concat's CRAFT_DESKS; computeQuality calls craftDeptMods(p) and adds .craft.
   - NOT CONSUMED YET (returned and correct, harmless if never used): the .aud and
     .legs members of craftDeptMods() and craftCriticAdj(p). Wiring them needs, in
     releaseFilm: + (_cdm.aud||0) on the audience line and + (_cdm.legs||0) on the legs
     line (store them on the project at computeQuality time), and in reviewFilm add
     craftCriticAdj(p) to the score passed to reviewFilm(). Until then the departments
     still pay off through .craft. The test exercises .aud/.legs/.critic directly.
   Every cash movement goes through spend() / earn().
   All state lives under S.craft (lazy craftEnsure(), old-save safe). */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var CRAFT_DEPTS = [
  { id: "cinematography", n: "Cinematography", em: "🎥",
    blurb: "Lenses, lighting and the colour grade — the look of the film." },
  { id: "design", n: "Production design", em: "🏛️",
    blurb: "Sets, worlds and the physical texture of every frame." },
  { id: "sound", n: "Sound mix", em: "🎚️",
    blurb: "Dialogue, score balance and the Atmos print critics listen to." },
  { id: "previz", n: "Pre-viz", em: "🧊",
    blurb: "Action beats previsualised before the shoot, so nothing is improvised." }
];

/* Per-tier department effect. craft/aud are integer adds, legs is added to the
   theatrical legs multiplier (1.4-4.4), critic feeds craftCriticAdj(). */
var CRAFT_EFF = {
  cinematography: { craft: [2, 3, 4], aud: [0, 1, 1], legs: [0.03, 0.05, 0.08], critic: [1, 2, 3] },
  design:         { craft: [1, 2, 3], aud: [1, 2, 3], legs: [0.01, 0.02, 0.03], critic: [0, 0, 0] },
  sound:          { craft: [1, 2, 3], aud: [0, 0, 1], legs: [0.00, 0.00, 0.02], critic: [2, 3, 5] },
  previz:         { craft: [2, 3, 5], aud: [1, 1, 2], legs: [0.02, 0.03, 0.05], critic: [0, 1, 1] }
};

/* Weekly retainer by tier ($M). Deliberately cheaper than a crew fee, because it
   is charged every single week for as long as the head is on staff. */
var CRAFT_RETAIN = {
  cinematography: [0.5, 0.9, 1.6],
  design:         [0.4, 0.7, 1.2],
  sound:          [0.3, 0.5, 0.9],
  previz:         [0.4, 0.6, 1.1]
};

var CRAFT_POOL_SIZE = 3;
var CRAFT_PHASES = ["pre", "shoot", "post"];
var CRAFT_CONTRACT = 26;        /* weeks per head contract */
var CRAFT_SIGN_MULT = 3;        /* signing fee = retainer x3 */
var CRAFT_ASSIGN_MULT = 2;      /* assignment fee = retainer x2 */
var CRAFT_SEVERANCE_MULT = 1.5; /* release cost = retainer x1.5 */
var CRAFT_FRESH_START = 100;
var CRAFT_FRESH_DECAY = 5;
var CRAFT_FRESH_FLOOR = 55;

/* ── small helpers ────────────────────────────────────────────── */
function craftR1(x) { return Math.round(x * 10) / 10; }
function craftDeptById(id) {
  var i;
  for (i = 0; i < CRAFT_DEPTS.length; i++) if (CRAFT_DEPTS[i].id === id) return CRAFT_DEPTS[i];
  return null;
}
function craftDeptName(id) { var d = craftDeptById(id); return d ? d.n : String(id); }
function craftSignFee(head) { return craftR1(head.retainer * CRAFT_SIGN_MULT); }
function craftAssignFee(head) { return craftR1(head.retainer * CRAFT_ASSIGN_MULT); }
function craftSeverance(head) { return craftR1(head.retainer * CRAFT_SEVERANCE_MULT); }

function craftEff(deptId, tier) {
  var row = CRAFT_EFF[deptId], t = clamp(tier, 1, 3) - 1;
  if (!row) return { craft: 0, aud: 0, legs: 0, critic: 0 };
  return { craft: row.craft[t], aud: row.aud[t], legs: row.legs[t], critic: row.critic[t] };
}
function craftEffText(deptId, tier) {
  var e = craftEff(deptId, tier), out = [];
  if (e.craft) out.push("craft +" + e.craft);
  if (e.aud) out.push("audiences +" + e.aud);
  if (e.legs) out.push("legs +" + e.legs.toFixed(2));
  if (e.critic) out.push("critics +" + e.critic);
  return out.join(" · ") || "no measurable effect";
}
function craftPhaseLabel(p) {
  return p.phase === "shoot" ? "Shooting" : p.phase === "post" ? "In post" : "Pre-production";
}

/* ── state (lazy ensure — old saves have no S.craft) ──────────── */
function craftEnsure() {
  if (!S) return;
  if (!S.craft) S.craft = {};
  var M = S.craft, i, d;
  if (!M.heads) M.heads = {};
  if (!M.pool) M.pool = {};
  if (!M.assign) M.assign = {};
  if (!M.fresh) M.fresh = {};
  if (!M.morale) M.morale = {};
  if (!isFinite(M.lastTick)) M.lastTick = 0;
  if (!isFinite(M.poolWk)) M.poolWk = 0;
  if (!isFinite(M.retainersPaid)) M.retainersPaid = 0;
  if (!isFinite(M.hires)) M.hires = 0;
  if (!isFinite(M.assigns)) M.assigns = 0;
  if (!isFinite(M.renewals)) M.renewals = 0;
  var fresh = false;
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    if (!M.pool[d.id] || !M.pool[d.id].length) { craftRegenDept(d.id); fresh = true; }
    if (!isFinite(M.morale[d.id])) M.morale[d.id] = 60;
  }
  if (fresh || M.poolWk === 0) M.poolWk = S.studio.week;
}

/* ── candidate board: 3 names per department, rotated weekly ──── */
function craftCand(deptId) {
  var tier = chance(0.24) ? 3 : chance(0.45) ? 2 : 1;
  var retainer = CRAFT_RETAIN[deptId][tier - 1];
  return {
    id: "cr" + (S.seq++), n: genName(), dept: deptId, tier: tier,
    retainer: retainer, sign: craftR1(retainer * CRAFT_SIGN_MULT),
    wk: S.studio.week
  };
}
function craftRegenDept(deptId) {
  var list = [], i;
  for (i = 0; i < CRAFT_POOL_SIZE; i++) list.push(craftCand(deptId));
  S.craft.pool[deptId] = list;
  return list;
}
function craftRotate() {
  var M = S.craft, i;
  if (M.poolWk === S.studio.week) return;
  for (i = 0; i < CRAFT_DEPTS.length; i++) craftRegenDept(CRAFT_DEPTS[i].id);
  M.poolWk = S.studio.week;
}
function craftFindCand(candId, deptId) {
  var M = S.craft, i, j, d, list;
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    if (deptId && d.id !== deptId) continue;
    list = M.pool[d.id] || [];
    for (j = 0; j < list.length; j++) if (list[j].id === candId) return list[j];
  }
  return null;
}

/* ── assignment bookkeeping ───────────────────────────────────── */
function craftFresh(pid) {
  var M = S && S.craft ? S.craft : null;
  if (!M || !M.fresh) return 0;
  var f = M.fresh[pid];
  return isFinite(f) ? f : 0;
}
/* Which project currently holds this department, or null. */
function craftDeptProject(deptId) {
  var M = S && S.craft ? S.craft : null;
  if (!M || !M.assign) return null;
  var pid, p;
  for (pid in M.assign) {
    if (!Object.prototype.hasOwnProperty.call(M.assign, pid)) continue;
    if (M.assign[pid] !== deptId) continue;
    p = findProject(pid);
    if (p) return p;
  }
  return null;
}
function craftClearDept(deptId) {
  var M = S.craft, pid, i, dead = [];
  for (pid in M.assign) {
    if (Object.prototype.hasOwnProperty.call(M.assign, pid) && M.assign[pid] === deptId) dead.push(pid);
  }
  for (i = 0; i < dead.length; i++) {
    delete M.assign[dead[i]];
    delete M.fresh[dead[i]];
  }
}
function craftClearProject(pid) {
  var M = S.craft;
  if (!M.assign) return;
  delete M.assign[pid];
  delete M.fresh[pid];
}

/* ── engine hook 1: per-project department effect ─────────────── */
function craftDeptMods(p) {
  var zero = { craft: 0, aud: 0, legs: 0 };
  if (!S || !S.craft || !p || !p.id) return zero;
  var M = S.craft;
  if (!M.assign || !M.heads) return zero;
  var deptId = M.assign[p.id];
  if (!deptId) return zero;
  var head = M.heads[deptId];
  if (!head) return zero;                 /* head was released after the assignment */
  var eff = craftEff(deptId, head.tier);
  if (!isFinite(head.tier)) return zero;
  var f = craftFresh(p.id);
  if (!(f > 0)) f = CRAFT_FRESH_FLOOR;
  var mult = f / 100;
  var craft = Math.round(eff.craft * mult);
  if (eff.craft > 0 && craft < 1) craft = 1;
  var aud = Math.round(eff.aud * mult);
  if (eff.aud > 0 && aud < 1) aud = 1;
  return {
    craft: craft,
    aud: aud,
    legs: Math.round(eff.legs * mult * 100) / 100
  };
}

/* ── engine hook 2: critic add from sound mix + colour grade ──── */
function craftCriticAdj(p) {
  if (!S || !S.craft || !p || !p.id) return 0;
  var M = S.craft;
  if (!M.assign || !M.heads) return 0;
  var deptId = M.assign[p.id];
  if (!deptId) return 0;
  var head = M.heads[deptId];
  if (!head) return 0;
  var eff = craftEff(deptId, head.tier);
  var f = craftFresh(p.id) / 100;
  if (!(f > 0)) f = CRAFT_FRESH_FLOOR / 100;
  /* the sound mix carries the full critic add; a colour grade lends half */
  var crit = eff.critic;
  if (deptId === "cinematography") crit = crit * 0.5;
  var add = Math.round(crit * f);
  return add > 0 ? add : 0;
}

/* ── mechanic 1: hire / replace a department head ─────────────── */
function craftHire(candId, deptId) {
  craftEnsure();
  var M = S.craft, cand = craftFindCand(candId, deptId), dept, current, replaces = false;
  if (!cand) return { err: "That candidate has left the board." };
  dept = craftDeptById(deptId || cand.dept);
  if (!dept) return { err: "Unknown craft department." };
  current = M.heads[dept.id] || null;
  if (current && current.id === cand.id) return { err: current.n + " already heads " + dept.n + "." };
  if (S.studio.cash < cand.sign) return { err: "Need " + fm(cand.sign) + " for the signing fee." };
  spend(cand.sign, "Craft signing · " + cand.n);
  if (current) {
    craftClearDept(dept.id);
    replaces = true;
  }
  M.heads[dept.id] = {
    id: cand.id, n: cand.n, dept: dept.id, tier: cand.tier,
    retainer: cand.retainer, sign: cand.sign,
    week: S.studio.week, until: S.studio.week + CRAFT_CONTRACT
  };
  M.morale[dept.id] = 70;
  M.hires++;
  /* the board keeps three names: the hired one is replaced immediately */
  var pool = M.pool[dept.id] || [], kept = [], i;
  for (i = 0; i < pool.length; i++) if (pool[i].id !== cand.id) kept.push(pool[i]);
  while (kept.length < CRAFT_POOL_SIZE) kept.push(craftCand(dept.id));
  M.pool[dept.id] = kept;
  if (replaces) {
    log("🔄 " + cand.n + " takes over " + dept.n + " from " + (current ? current.n : "the last head") + " — " + fm(cand.sign) + " signing fee, " + fm(cand.retainer) + "/wk.", "good", "🔄");
  } else {
    log("🎬 " + cand.n + " heads " + dept.n + " — tier " + cand.tier + ", " + fm(cand.sign) + " signing fee, " + fm(cand.retainer) + "/wk.", "good", "🎬");
  }
  toast(dept.n + ": " + cand.n + " hired (" + craftEffText(dept.id, cand.tier) + ").", "good");
  return { ok: true, dept: dept.id, head: M.heads[dept.id] };
}

/* ── mechanic 2: release a head (severance) ───────────────────── */
function craftFire(deptId) {
  craftEnsure();
  var M = S.craft, head = M.heads[deptId];
  if (!head) return { err: "No head on staff in " + craftDeptName(deptId) + "." };
  var sev = craftSeverance(head);
  if (S.studio.cash < sev) return { err: "Need " + fm(sev) + " severance to release " + head.n + "." };
  spend(sev, "Craft severance · " + head.n);
  craftClearDept(deptId);
  delete M.heads[deptId];
  M.morale[deptId] = Math.max(20, (M.morale[deptId] || 60) - 10);
  log("📤 " + head.n + " leaves " + craftDeptName(deptId) + " — " + fm(sev) + " severance, the department goes dark.", "", "📤");
  toast(head.n + " released from " + craftDeptName(deptId) + ".", "");
  return { ok: true };
}

/* ── mechanic 3: lend a department to one project ─────────────── */
function craftAssign(pid, deptId) {
  craftEnsure();
  var M = S.craft, p, dept, head, holder;
  if (deptId === "none" || deptId === "clear" || !deptId) {
    p = findProject(pid);
    if (!p) return { err: "That project is gone." };
    if (!M.assign[p.id]) return { err: "“" + p.title + "” has no craft head to clear." };
    craftClearProject(p.id);
    log("🎬 The craft head steps off “" + p.title + "”.", "", "🎬");
    toast("Craft head cleared from “" + p.title + "”.", "");
    return { ok: true };
  }
  p = findProject(pid);
  if (!p) return { err: "That project is gone." };
  if (CRAFT_PHASES.indexOf(p.phase) < 0) return { err: "Craft heads join in pre-production, shoot or post." };
  dept = craftDeptById(deptId);
  if (!dept) return { err: "Unknown craft department." };
  head = M.heads[dept.id];
  if (!head) return { err: "Hire a head for " + dept.n + " first." };
  if (M.assign[p.id] === dept.id) return { err: dept.n + " is already on “" + p.title + "”." };
  holder = craftDeptProject(dept.id);
  if (holder && holder.id !== p.id) return { err: dept.n + " is already on “" + holder.title + "”. Clear it there first." };
  if (M.assign[p.id]) return { err: "“" + p.title + "” already has " + craftDeptName(M.assign[p.id]) + "." };
  var fee = craftAssignFee(head);
  if (S.studio.cash < fee) return { err: "Need " + fm(fee) + " to put " + dept.n + " on “" + p.title + "”." };
  spend(fee, "Craft assignment · " + dept.n + " · " + p.title);
  M.assign[p.id] = dept.id;
  M.fresh[p.id] = CRAFT_FRESH_START;
  M.assigns++;
  log("🤝 " + head.n + " (" + dept.n + ") joins “" + p.title + "” — " + craftEffText(dept.id, head.tier) + ".", "good", "🤝");
  toast(dept.n + " on “" + p.title + "”: " + craftEffText(dept.id, head.tier) + ".", "good");
  return { ok: true, craft: craftDeptMods(p).craft };
}

/* ── weekly tick ──────────────────────────────────────────────── */
function tickCraft() {
  if (!S) return;
  craftEnsure();
  var M = S.craft;
  if (M.lastTick === S.studio.week) return;   /* double-tick guard, non-negotiable */
  M.lastTick = S.studio.week;
  if (S.over) return;
  var i, d, head, pid, logs = 0, paid = 0;

  /* 1. retainers: every seated head is paid this week */
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    head = M.heads[d.id];
    if (!head) continue;
    spend(head.retainer, "Craft retainer · " + d.n);
    paid += head.retainer;
  }
  if (paid > 0) M.retainersPaid = craftR1((M.retainersPaid || 0) + paid);

  /* 2. the board rotates every week */
  craftRotate();

  /* 3. contract renewals (+8%) or the head walks */
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    head = M.heads[d.id];
    if (!head || !isFinite(head.until)) continue;
    if (head.until > S.studio.week) continue;
    if (S.studio.cash < head.retainer * 2) {
      craftClearDept(d.id);
      delete M.heads[d.id];
      if (logs < 2) {
        log("📄 " + head.n + " walks — the studio cannot fund the " + d.n + " renewal.", "bad", "📄");
        logs++;
      }
      continue;
    }
    head.retainer = craftR1(head.retainer * 1.08);
    head.until = S.studio.week + CRAFT_CONTRACT;
    M.renewals++;
    if (logs < 2) {
      log("📄 " + d.n + " renewed with " + head.n + " — " + fm(head.retainer) + "/wk for " + CRAFT_CONTRACT + " more weeks.", "", "📄");
      logs++;
    }
  }

  /* 4. morale: a busy department is a happy one */
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    head = M.heads[d.id];
    if (!head) {
      M.morale[d.id] = Math.max(15, (M.morale[d.id] || 40) - 1);
      continue;
    }
    if (craftDeptProject(d.id)) {
      M.morale[d.id] = clamp((M.morale[d.id] || 60) + 3, 0, 100);
    } else {
      M.morale[d.id] = clamp((M.morale[d.id] || 60) - 6, 0, 100);
      if (M.morale[d.id] <= 10 && chance(0.04)) {
        var quit = head;
        craftClearDept(d.id);
        delete M.heads[d.id];
        if (logs < 2) {
          log("🚪 " + quit.n + " quits " + d.n + " — " + CRAFT_CONTRACT + " weeks on the bench was too long.", "bad", "🚪");
          logs++;
        }
      }
    }
  }

  /* 5. assignment freshness decays; orphaned assignments are dropped */
  var dead = [], wrapped = [];
  for (pid in M.assign) {
    if (!Object.prototype.hasOwnProperty.call(M.assign, pid)) continue;
    var owner = M.heads[M.assign[pid]];
    var proj = findProject(pid);
    if (!proj) { dead.push(pid); if (owner) wrapped.push(M.assign[pid]); continue; }
    if (!owner) { dead.push(pid); continue; }
    /* the department leaves when the film does — wrapped post, or scheduled for release */
    if (CRAFT_PHASES.indexOf(proj.phase) < 0) { dead.push(pid); wrapped.push(M.assign[pid]); continue; }
    var f = M.fresh[pid];
    if (!isFinite(f)) f = CRAFT_FRESH_START;
    M.fresh[pid] = Math.max(CRAFT_FRESH_FLOOR, f - CRAFT_FRESH_DECAY);
  }
  for (i = 0; i < dead.length; i++) craftClearProject(dead[i]);
  /* count the wrap once per department so "house style" can be earned */
  for (i = 0; i < wrapped.length; i++) {
    var h = M.heads[wrapped[i]];
    if (h) h.releases = (isFinite(h.releases) ? h.releases : 0) + 1;
  }
}

/* ── payroll helper (desk + forecasts) ────────────────────────── */
function craftPayroll() {
  if (!S || !S.craft || !S.craft.heads) return 0;
  var t = 0, i, d, head;
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    head = S.craft.heads[d.id];
    if (head && isFinite(head.retainer)) t += head.retainer;
  }
  return craftR1(t);
}

/* ── commit + action delegation (ui calls craftAction) ────────── */
function craftCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function craftAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("craft-") !== 0) return false;
  craftEnsure();
  var id = (elx && elx.getAttribute) ? elx.getAttribute("data-id") : null;
  var key = (elx && elx.getAttribute) ? elx.getAttribute("data-key") : null;
  var r;
  if (a === "craft-hire") r = craftHire(id, key);
  else if (a === "craft-assign") r = craftAssign(id, key);
  else if (a === "craft-fire") r = craftFire(id);
  else return false;
  if (r && r.err) toast(r.err, "bad");
  else craftCommit();
  return true;
}

/* ── desk 1: the four departments and their boards ────────────── */
function craftDeptsDesk() {
  craftEnsure();
  var M = S.craft, st = S.studio, i, j, d, head, list, c, html = "";
  var seated = 0, assigned = 0;
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    if (M.heads[d.id]) seated++;
    if (craftDeptProject(d.id)) assigned++;
  }
  html += '<div class="card">'
    + statrow("Weekly craft payroll", craftPayroll() > 0 ? "-" + fm(craftPayroll()) : fm(0), craftPayroll() > 0 ? "down" : "")
    + statrow("Departments seated", seated + " / " + CRAFT_DEPTS.length)
    + statrow("Assignments live", String(assigned))
    + statrow("Retainers paid to date", fm(M.retainersPaid || 0))
    + statrow("Cash on hand", fm(st.cash))
    + "</div>";
  html += '<div class="sechead"><h2>Departments</h2></div>';
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    head = M.heads[d.id] || null;
    html += '<div class="card film"><div class="head"><div class="title">' + d.em + " " + esc(d.n) + "</div>"
      + tag(head ? "Seated" : "Vacant", head ? "green" : "") + "</div>";
    if (head) {
      var proj = craftDeptProject(d.id);
      html += '<div class="meta">' + tag(esc(head.n), "blue") + tag("Tier " + head.tier, "gold")
        + tag(fm(head.retainer) + "/wk", "") + "</div>";
      html += statrow("Effect on the film", esc(craftEffText(d.id, head.tier)), "up");
      html += '<div class="statrow"><span class="k">Assigned to</span><span class="v">'
        + (proj ? tag(esc(proj.title), "green") : tag("Idle — pick a project", "")) + "</span></div>";
      html += '<div class="statrow"><span class="k">Morale</span><span class="v num">'
        + Math.round(M.morale[d.id] || 0) + "/100</span></div>";
      html += '<div class="btnrow"><button class="btn sm" data-action="craft-fire" data-id="' + d.id + '"'
        + (st.cash < craftSeverance(head) ? " disabled" : "") + ">Release · " + fm(craftSeverance(head)) + "</button></div>";
    } else {
      html += '<div class="meta">' + tag(esc(d.blurb), "") + "</div>";
    }
    list = M.pool[d.id] || [];
    if (!list.length) {
      html += '<div class="empty"><span class="em">' + d.em + "</span>No candidates on the board this week — the board refreshes next week.</div>";
    }
    for (j = 0; j < list.length; j++) {
      c = list[j];
      if (head && head.id === c.id) continue;
      html += '<div class="statrow"><span class="k">' + esc(c.n) + " · T" + c.tier + " · " + fm(c.retainer)
        + "/wk<br><small>" + esc(craftEffText(d.id, c.tier)) + "</small></span>"
        + '<span class="v"><button class="btn sm" data-action="craft-hire" data-id="' + esc(c.id) + '" data-key="' + d.id + '"'
        + (st.cash < c.sign ? " disabled" : "") + ">" + (head ? "Replace" : "Hire") + " · " + fm(c.sign) + "</button></span></div>";
    }
    html += "</div>";
  }
  return html;
}

/* ── desk 2: assign heads to projects in production ──────────── */
function craftAssignDesk() {
  craftEnsure();
  var M = S.craft, st = S.studio, i, j, d, head, p, holder, cur, btn, list = [], html = "";
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    if (CRAFT_PHASES.indexOf(p.phase) >= 0) list.push(p);
  }
  var seated = 0, free = 0;
  for (i = 0; i < CRAFT_DEPTS.length; i++) {
    d = CRAFT_DEPTS[i];
    if (!M.heads[d.id]) continue;
    seated++;
    if (!craftDeptProject(d.id)) free++;
  }
  html += '<div class="card">'
    + statrow("Heads seated", seated + " / " + CRAFT_DEPTS.length)
    + statrow("Heads free to assign", String(free))
    + statrow("Projects in production", String(list.length))
    + statrow("Assignment fee", "head retainer ×" + CRAFT_ASSIGN_MULT)
    + "</div>";
  if (!seated) return html + '<div class="empty"><span class="em">🎬</span>No department head on staff yet — hire one in Craft departments first.</div>';
  if (!list.length) return html + '<div class="empty"><span class="em">🎬</span>Nothing in pre-production, shoot or post. A department only joins work already in progress.</div>';
  html += '<div class="sechead"><h2>Projects</h2></div>';
  for (i = 0; i < list.length && i < 4; i++) {
    p = list[i];
    cur = M.assign[p.id] ? craftDeptById(M.assign[p.id]) : null;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(p.title) + "</div>"
      + tag(craftPhaseLabel(p), "blue") + "</div>";
    html += '<div class="meta">'
      + (cur ? tag("Craft: " + esc(cur.n), "green") + tag("Fresh " + Math.round(craftFresh(p.id)) + "%", "") : tag("No craft department", ""))
      + tag("Cash " + fm(st.cash), "") + "</div>";
    for (j = 0; j < CRAFT_DEPTS.length; j++) {
      d = CRAFT_DEPTS[j];
      head = M.heads[d.id] || null;
      holder = craftDeptProject(d.id);
      if (!head) btn = tag("No head", "red");
      else if (M.assign[p.id] === d.id) btn = tag("Assigned", "green");
      else if (holder) btn = tag("On another film", "");
      else btn = '<button class="btn sm" data-action="craft-assign" data-id="' + esc(p.id) + '" data-key="' + d.id + '"'
        + (st.cash < craftAssignFee(head) ? " disabled" : "") + ">Assign · " + fm(craftAssignFee(head)) + "</button>";
      html += '<div class="statrow"><span class="k">' + d.em + " " + esc(d.n)
        + (head ? " · " + esc(head.n) + " · T" + head.tier : "") + '</span><span class="v">' + btn + "</span></div>";
    }
    if (M.assign[p.id]) {
      html += '<div class="btnrow"><button class="btn sm" data-action="craft-assign" data-id="' + esc(p.id) + '" data-key="none">Clear craft head</button></div>';
    }
    html += "</div>";
  }
  return html;
}

var CRAFT_DESKS = [
  { id: "craft-depts", group: "Production", icon: "🎬", name: "Craft departments",
    desc: "Cinematography, production design, sound mix and pre-viz — hire a head per department, pay their weekly retainer and read their effect.",
    render: craftDeptsDesk },
  { id: "craft-assign", group: "Production", icon: "🤝", name: "Craft assignments",
    desc: "Lend a department head to a film in pre-production, shoot or post. The lift applies to that project only.",
    render: craftAssignDesk }
];

/* ── achievements published to meta.js (merged by allAchievements()) ── */
var CRAFT_ACHIEVEMENTS = [
  { id: "craft-first-head", tier: 1, name: "Below the line",
    desc: "Put your first department head on staff.",
    test: function (S) {
      if (!S || !S.craft || !S.craft.heads) return false;
      var i;
      for (i = 0; i < CRAFT_DEPTS.length; i++) if (S.craft.heads[CRAFT_DEPTS[i].id]) return true;
      return false;
    } },
  { id: "craft-full-house", tier: 2, name: "Four departments",
    desc: "Seat a head in all four craft departments at once.",
    test: function (S) {
      if (!S || !S.craft || !S.craft.heads) return false;
      var i;
      for (i = 0; i < CRAFT_DEPTS.length; i++) if (!S.craft.heads[CRAFT_DEPTS[i].id]) return false;
      return CRAFT_DEPTS.length > 0;
    } },
  { id: "craft-first-assignment", tier: 1, name: "On the floor",
    desc: "Assign a craft head to a film in production.",
    test: function (S) { return !!S && !!S.craft && isFinite(S.craft.assigns) && S.craft.assigns >= 1; } },
  { id: "craft-retainers-40", tier: 2, name: "Standing payroll",
    desc: "Pay $40M of craft department retainers.",
    test: function (S) { return !!S && !!S.craft && S.craft.retainersPaid >= 40; } },
  { id: "craft-hires-8", tier: 3, name: "Department builder",
    desc: "Sign eight department heads across your career.",
    test: function (S) { return !!S && !!S.craft && isFinite(S.craft.hires) && S.craft.hires >= 8; } },
  { id: "craft-reputed-dept", tier: 3, name: "House style",
    desc: "Release a film that carried a tier-3 craft department.",
    test: function (S) {
      if (!S || !S.craft || !S.craft.heads) return false;
      var i;
      for (i = 0; i < CRAFT_DEPTS.length; i++) {
        var h = S.craft.heads[CRAFT_DEPTS[i].id];
        if (h && h.tier === 3 && isFinite(h.releases) && h.releases >= 1) return true;
      }
      return false;
    } }
];
