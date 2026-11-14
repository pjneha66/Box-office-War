/* Box Office War — rebuilt. Technology module — all state under S.tech.
   One sequential research chain of 7 eras: Silent Era (the start, skipped) →
   Sound → Color → Widescreen → Digital → IMAX → Virtual Production.
   One research at a time; the cost is paid upfront and progress is week-based
   (researching.started holds the absolute start week), so every completion is
   permanent and the effects compound:
   - techCraftBonus() → sum of craft adds of done techs (engine computeQuality, LIVE)
   - techOpenMult()  → product of opening mults of done techs (engine expectedOpening, LIVE)
   Also defined: tickTech() (weekly resolve), forecastAdjust_tech() → 0 (research
   moves cash only at start, never weekly — the global forecastAdjust aggregator
   is owned by ui.js, so modules suffix _tech, uniform with library/finance/media).
   NOTE for integrator: engine.js advanceWeek does not call tickTech yet (the tick
   list ends at tickMeta) and collectDesks() does not concat TECH_DESKS yet; ui.js
   already bridges techAction in onAction. Because progress is derived from
   S.studio.week, completions resolve lazily via techResolve() (called by the hooks
   and the desk) on exactly the right week — with or without the tick hook. If the
   integrator adds `if (typeof tickTech === "function") tickTech();` to advanceWeek,
   the same call is an idempotent no-op-safe extra. */
"use strict";

/* ── module data ─────────────────────────────────────────────── */
var TECH_TREE = [
  { id: "silent",     n: "Silent Era",          desc: "Orchestra pits and title cards — where every studio begins. Nothing to research; the sound revolution is next.", cost: 0,   weeks: 0,  craft: 0, open: 1 },
  { id: "sound",      n: "Sound",               desc: "Talkies required — audiences demand voices, and every theater is wiring up.",                                     cost: 18,  weeks: 6,  craft: 2, open: 1.02 },
  { id: "color",      n: "Color",               desc: "Three-strip color stock — musicals and epics glow, accountants wince.",                                           cost: 40,  weeks: 8,  craft: 3, open: 1.03 },
  { id: "widescreen", n: "Widescreen",          desc: "Bigger frames for bigger spectacles — the roadshow era arrives.",                                                 cost: 60,  weeks: 8,  craft: 3, open: 1.04 },
  { id: "digital",    n: "Digital",             desc: "Digital cameras and DI pipelines — lighter crews, cleaner grades.",                                               cost: 90,  weeks: 10, craft: 4, open: 1.05 },
  { id: "imax",       n: "IMAX",                desc: "15-perf 70mm and giant screens — event films become destinations.",                                               cost: 130, weeks: 10, craft: 4, open: 1.06 },
  { id: "vprod",      n: "Virtual Production",  desc: "LED volumes and real-time engines — shoot anywhere without leaving the lot.",                                     cost: 180, weeks: 12, craft: 5, open: 1.08 }
];

/* ── state (lazy ensure — old saves have no S.tech) ──────────── */
function techEnsure() {
  if (!S.tech) S.tech = { done: [], researching: null };
}
function techById(id) {
  var i;
  for (i = 0; i < TECH_TREE.length; i++) if (TECH_TREE[i].id === id) return TECH_TREE[i];
  return null;
}
function techIsDone(t) { return t.id === "silent" || S.tech.done.indexOf(t.id) >= 0; }
/* The chain is strict: the next researchable tech is the first non-Silent entry
   not yet done. Silent Era (index 0) is the skipped starting point. */
function techNext() {
  var i;
  for (i = 1; i < TECH_TREE.length; i++) if (!techIsDone(TECH_TREE[i])) return TECH_TREE[i];
  return null;
}
/* Complete any research whose weeks have elapsed. Week-based, so it is
   idempotent and safe to call from the tick, the hooks or the desk. */
function techResolve() {
  techEnsure();
  if (!S.tech.researching) return null;
  var t = techById(S.tech.researching.id);
  if (t && S.studio.week - S.tech.researching.started >= t.weeks) {
    S.tech.done.push(t.id);
    S.tech.researching = null;
    log("🔬 " + t.n + " research complete — craft +" + t.craft + " and openings ×" + t.open.toFixed(2) + " on every film from now on. Permanent.", "gold", "🔬");
    toast("🔬 " + t.n + " mastered.", "gold");
    return t;
  }
  return null;
}
function techWeeksLeft(t) { return Math.max(0, t.weeks - (S.studio.week - S.tech.researching.started)); }

/* ── research start (cost upfront, one at a time) ────────────── */
function techStart() {
  techResolve();
  if (S.tech.researching) {
    var cur = techById(S.tech.researching.id);
    return { err: "The lab is busy — " + (cur ? cur.n : "a project") + " is still in research." };
  }
  var next = techNext();
  if (!next) return { err: "Every technology on the tree is already yours." };
  if (S.studio.cash < next.cost) return { err: "Need " + fm(next.cost) + " to start " + next.n + " research." };
  spend(next.cost, "Research · " + next.n);
  S.tech.researching = { id: next.id, started: S.studio.week };
  log("Research begins: " + next.n + " — " + fm(next.cost) + " committed, about " + next.weeks + " weeks to results.", "", "🔬");
  toast("🔬 " + next.n + " research started.", "");
  return { ok: true, tech: next };
}

/* ── engine hooks ────────────────────────────────────────────── */
/* Craft add on every film — sum of done techs. Resolves due completions first,
   so a film wrapping the same week the tech lands already gets the bonus. */
function techCraftBonus() {
  if (!S) return 0;
  techResolve();
  var n = 0, i, t;
  for (i = 0; i < S.tech.done.length; i++) {
    t = techById(S.tech.done[i]);
    if (t) n += t.craft;
  }
  return n;
}
/* Opening multiplier — product of done techs' open mults. Compounds: two done
   techs at ×1.02 and ×1.03 give ×1.0506. */
function techOpenMult() {
  if (!S) return 1;
  techResolve();
  var m = 1, i, t;
  for (i = 0; i < S.tech.done.length; i++) {
    t = techById(S.tech.done[i]);
    if (t) m *= t.open;
  }
  return m;
}
/* Research is paid upfront — no weekly cash flows, forecast stays clean. */
function forecastAdjust_tech() { return 0; }

/* ── weekly tick (guarded no-op if the engine hook is not wired yet) ── */
function tickTech() {
  if (!S || S.over) return;
  techResolve();
}

/* ── commit + action delegation (ui calls techAction first) ──── */
function techCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function techHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  techCommit();
}
function techAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("tech-") !== 0) return false;
  techResolve();
  if (a === "tech-research") { techHandle(techStart()); return true; }
  return false;
}

/* ── desk ────────────────────────────────────────────────────── */
function techRow(i) {
  var t = TECH_TREE[i];
  var res = !!(S.tech.researching && S.tech.researching.id === t.id);
  var isNext = !res && !techIsDone(t) && techNext() === t;
  var k = "🔬 " + t.n + '<br><small style="color:var(--faint)">' + esc(t.desc) + "</small>";
  var v;
  if (techIsDone(t)) {
    v = tag(t.id === "silent" ? "Start" : "✓ Done", "green");
  } else if (res) {
    v = tag((S.studio.week - S.tech.researching.started) + "/" + t.weeks + " wks", "blue");
  } else if (isNext) {
    v = tag("Next · " + fm(t.cost), "gold");
  } else {
    v = tag("🔒 Needs " + TECH_TREE[i - 1].n, "");
  }
  var html = '<div class="statrow"><span class="k">' + k + "</span>" + '<span class="v num">' + v + "</span></div>";
  if (res) html += '<div class="bar"><i style="width:' + clamp(Math.round((S.studio.week - S.tech.researching.started) / t.weeks * 100), 3, 100) + '%"></i></div>';
  return html;
}

function techDesk() {
  techResolve();
  var next = techNext();
  var res = S.tech.researching ? techById(S.tech.researching.id) : null;
  var bonus = techCraftBonus(), mult = techOpenMult();
  var i, t, html = "<div>";
  html += '<div class="card">'
    + statrow("Craft bonus on every film", bonus > 0 ? "+" + bonus : "0", bonus > 0 ? "up" : "")
    + statrow("Opening multiplier", "×" + mult.toFixed(2), mult > 1 ? "up" : "")
    + statrow("Researching", res ? esc(res.n) + " · " + techWeeksLeft(res) + (techWeeksLeft(res) === 1 ? " week left" : " weeks left") : "—")
    + "</div>";
  html += '<div class="sechead"><h2>The chain</h2></div><div class="card">';
  for (i = 0; i < TECH_TREE.length; i++) html += techRow(i);
  html += "</div>";
  if (next) {
    html += '<div class="sechead"><h2>Research</h2></div><div class="card">'
      + '<div class="statrow"><span class="k">' + esc(next.n) + " · " + fm(next.cost)
      + "<br><small style='color:var(--faint)'>" + esc(next.desc) + " · +" + next.craft + " craft, openings ×" + next.open.toFixed(2)
      + " · cash after " + fm(S.studio.cash - next.cost) + "</small></span>"
      + '<button class="btn primary sm" data-action="tech-research" ' + (S.tech.researching || S.studio.cash < next.cost ? "disabled" : "") + ">"
      + (S.tech.researching ? "In progress" : "Research · " + fm(next.cost)) + "</button></div>";
    if (res) html += statrow("Weeks remaining", String(techWeeksLeft(res)));
    html += "</div>";
  } else {
    html += '<div class="card"><div class="empty"><span class="em">🔬</span>The whole tree is yours — every film opens bigger and lands better, permanently.</div></div>';
  }
  html += '<div class="card"><div class="empty" style="padding:8px 0 0">One research at a time · costs are paid upfront · effects are permanent and compound.</div></div>';
  return html + "</div>";
}

var TECH_DESKS = [
  { id: "tech-tree", group: "Technology", icon: "🔬", name: "Research tree",
    desc: "The long game — seven eras of technology, each film permanently better than the last.",
    render: techDesk }
];
