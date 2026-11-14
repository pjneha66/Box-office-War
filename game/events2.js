/* Box Office War — rebuilt. Events module (wave 5) — all state under S.ev2.
   Systems: premiere plans (a per-release opening lift, applied from the engine's live
   premiereApply(p, f) hook inside releaseFilm) · award-show night (the engine's live
   awardNightBegin(nominees, best) hook — resolved through a generic S.pending choice
   sheet dispatched back to events2Action as "pending-opt") · crisis years (the engine's
   live crisisYearRoll() hook at the year boundary in tickMine; the choice + weekly
   effects run in tickEvents2, since engine econ.box cannot be modified from here) ·
   rival subscription attacks (weekly roll while a streamer exists, resolved via the
   same pending sheet). Event log desk lists S.ev2.history.
   Wiring: engine calls premiereApply / awardNightBegin / crisisYearRoll (all LIVE in
   this build). tickEvents2() and EVENTS2_DESKS are defined here for the integrator's
   weekly tick + desk concat; events2Action bridges both desk actions and "pending-opt"
   (ui.js already dispatches pending-opt to events2Action). lastTick-guarded so a double
   hook (integrator wiring + manual) never double-processes a week. The engine has no
   fans stat, so the grand gala's "fans +" is news flavor only. S.tv reads are guarded —
   tv.js may be absent on old saves. */
"use strict";

/* ── state (lazy ensure — old saves have no S.ev2) ────────────── */
function ev2Ensure() {
  if (!S.ev2) S.ev2 = { plan: "none", applied: {}, history: [], lastTick: 0 };
  if (!S.ev2.plan) S.ev2.plan = "none";
  if (!S.ev2.applied) S.ev2.applied = {};
  if (!S.ev2.history) S.ev2.history = [];
  if (S.ev2.lastTick == null) S.ev2.lastTick = 0;
}

var EV2_PLANS = {
  none: { name: "None", cost: 0, lift: 0, rep: 0 },
  standard: { name: "Standard premiere", cost: 2, lift: 0.04, rep: 1 },
  grand: { name: "Grand gala", cost: 6, lift: 0.08, rep: 2 }
};

function ev2Hist(txt) {
  ev2Ensure();
  S.ev2.history.unshift({ w: S.studio.week, t: txt });
  if (S.ev2.history.length > 30) S.ev2.history.length = 30;
}
function ev2Toast(txt, kind) {
  if (typeof pushToast === "function") pushToast(txt, kind);
  else toast(txt, kind);
}

/* ── (1) premiere night — engine releaseFilm calls premiereApply(p, f) ── */
function premiereApply(p, f) {
  ev2Ensure();
  if (!f || !f.id || S.ev2.applied[f.id]) return;
  var plan = EV2_PLANS[S.ev2.plan];
  if (!plan || S.ev2.plan === "none") return;
  S.ev2.applied[f.id] = true;
  if (S.studio.cash < plan.cost) {
    log("The “" + f.title + "” premiere was cancelled — the till was short.", "bad", "🎬");
    ev2Hist("Premiere cancelled for “" + f.title + "” (insufficient cash).");
    return;
  }
  spend(plan.cost, "Premiere · " + f.title);
  /* opening is already rolled at this point — apply the lift directly to it */
  f.opening = Math.round(f.opening * (1 + plan.lift) * 10) / 10;
  f.buzzNote = plan.name;
  S.studio.rep = clamp(S.studio.rep + plan.rep, 0, 100);
  log("🎬 Premiere night: " + plan.name + " for “" + f.title + "” — opening lifts to " +
    fm(f.opening) + ". Rep +" + plan.rep + (S.ev2.plan === "grand" ? ", fans camp the red carpet." : "."),
    "good", "🎬");
  toast("🎬 Premiere lift: “" + f.title + "” opens at " + fm(f.opening) + ".", "good");
  ev2Hist(plan.name + " held for “" + f.title + "” — opening " + fm(f.opening) + ".");
}

/* ── (2) award show night — engine yearAwards calls awardNightBegin(noms, best) ── */
function ev2ApplyWinner(pack) {
  if (pack.best) {
    S.studio.rep = clamp(S.studio.rep + 8, 0, 100);
    S.studio.catalog += 25;
    log("🏆 Year " + S.studio.year + " awards: “" + pack.best.title + "” takes Best Picture. Reputation +8.", "gold", "🏆");
    toast("🏆 “" + pack.best.title + "” wins Best Picture!", "gold");
    ev2Hist("“" + pack.best.title + "” wins Best Picture at the Year " + S.studio.year + " awards.");
  } else {
    log("Awards night passes without a trophy for your studio. Next year.", "", "🏆");
    ev2Hist("Awards night, Year " + S.studio.year + ": no trophy.");
  }
  S.yearOfFilms = [];
}

function awardNightBegin(nominees, best) {
  ev2Ensure();
  var noms = nominees || [];
  var pack = { noms: noms, best: best || null };
  if (S.pending) { ev2ApplyWinner(pack); return; } /* slot busy — resolve like the engine's auto path */
  S.pending = {
    type: "awards", title: "🏆 Award night", nominees: noms, best: pack.best,
    text: "Your films earned " + noms.length + " nomination(s).",
    options: [
      { label: "Attend humbly", note: "+2 rep" },
      { label: "Bold speech", note: "50%: +5 rep / 50%: -2 rep" },
      { label: "Skip the show", note: "nothing" }
    ]
  };
}

function ev2AwardOpt(idx, pd) {
  if (idx === 0) {
    S.studio.rep = clamp(S.studio.rep + 2, 0, 100);
    log("🏆 The studio takes its seats gracefully at the award show. Rep +2.", "", "🏆");
    ev2Toast("Humble and classy. Rep +2.", "good");
  } else if (idx === 1) {
    if (chance(0.5)) {
      S.studio.rep = clamp(S.studio.rep + 5, 0, 100);
      log("🏆 The bold acceptance speech brings the house down. Rep +5.", "good", "🏆");
      ev2Toast("The speech lands. Rep +5.", "good");
    } else {
      S.studio.rep = clamp(S.studio.rep - 2, 0, 100);
      log("🏆 The bold speech lands badly — the room goes cold. Rep -2.", "bad", "🏆");
      ev2Toast("The speech bombs. Rep -2.", "bad");
    }
  } else {
    log("🏆 The studio skips the award show entirely.", "", "🏆");
  }
  ev2ApplyWinner(pd);
}

/* ── (3) crisis years — engine tickMine calls crisisYearRoll() at the boundary ── */
function ev2CrisisChoice() {
  S.pending = {
    type: "crisis", title: "📉 Crisis year", year: S.crisis.year,
    text: "The market will run soft all year.",
    options: [
      { label: "Austerity", note: "overhead halved this year", cost: 0 },
      { label: "Fight back", note: "normal costs, +2 buzz/wk on announced films", cost: 3 },
      { label: "Borrow through it", note: "+$40M now, debt grows", cost: 0 }
    ]
  };
  S.crisis.choicePending = false;
}

function crisisYearRoll() {
  ev2Ensure();
  if (S.crisis) return; /* a crisis is already running */
  if (!chance(0.08)) return;
  S.crisis = { year: S.studio.year, mult: 0.85, austerity: false, fight: false, choicePending: false };
  log("📉 A crisis year begins — the market runs 15% soft.", "bad", "📉");
  ev2Hist("A crisis year begins (Year " + S.studio.year + ").");
  if (!S.pending) ev2CrisisChoice();
  else S.crisis.choicePending = true; /* defer the choice until the pending slot frees */
}

function ev2CrisisOpt(idx) {
  if (idx === 0) {
    S.crisis.austerity = true;
    log("🪒 Austerity declared — savings land back each week this year.", "", "📉");
    ev2Toast("Austerity: weekly savings all year.", "");
    ev2Hist("Austerity declared for the crisis year.");
  } else if (idx === 1) {
    if (S.studio.cash >= 3) {
      spend(3, "Crisis fight-back");
      S.crisis.fight = true;
      log("📣 We fight back — every announced film gets +2 buzz a week.", "good", "📣");
      ev2Toast("Fight back: +2 buzz/wk on the slate.", "good");
      ev2Hist("Fight-back funded for the crisis year.");
    } else {
      ev2Toast("Not enough cash to fight back.", "bad");
    }
  } else {
    S.loans.push({ amt: 40, rate: 0.008 });
    earn(40, "Crisis borrowing");
    log("🏦 Borrowed $40M to ride out the crisis year — 0.8% interest per week.", "bad", "🏦");
    ev2Toast("+$40M crisis borrowing.", "bad");
    ev2Hist("Borrowed $40M through the crisis year.");
  }
}

/* ── (4) rival subscription attacks ───────────────────────────── */
function ev2SubwarOpt(idx) {
  var st = (S.tv && S.tv.streamer) ? S.tv.streamer : null;
  if (!st) return;
  if (idx === 0 && S.studio.cash >= 10) {
    spend(10, "Subscription war · matched discount");
    log("⚔️ Discount matched — " + st.name + " keeps its subscribers.", "", "⚔️");
    ev2Toast("Discount matched. Subs held.", "");
    ev2Hist("Subscription war: discount matched (" + st.name + ").");
  } else if (idx === 1 && S.studio.cash >= 4) {
    spend(4, "Subscription war · exclusives blitz");
    st.subs += 0.5;
    log("⚔️ Exclusives blitz — " + st.name + " gains 0.5M subscribers.", "good", "⚔️");
    ev2Toast("Exclusives blitz: subs +0.5M.", "good");
    ev2Hist("Subscription war: exclusives blitz (" + st.name + ").");
  } else {
    if (idx !== 2) ev2Toast("Not enough cash — the war is lost.", "bad");
    st.subs = Math.max(0.1, st.subs * 0.92);
    log("⚔️ The discount war runs its course — " + st.name + " sheds 8% of subscribers.", "bad", "⚔️");
    ev2Hist("Subscription war: ignored, subs -8% (" + st.name + ").");
  }
}

/* ── weekly tick (integrator wiring; lastTick-guarded) ────────── */
function tickEvents2() {
  ev2Ensure();
  if (S.ev2.lastTick === S.studio.week) return;
  S.ev2.lastTick = S.studio.week;
  /* clear the crisis once the studio has moved into the year after it */
  if (S.crisis && S.studio.year > S.crisis.year) {
    S.crisis = null;
    log("📈 The crisis year ends — the market recovers.", "good", "📈");
    ev2Hist("The crisis year ends.");
  }
  if (S.crisis) {
    if (S.crisis.austerity) earn(0.5, "Austerity savings");
    if (S.crisis.fight) {
      for (var i = 0; i < S.projects.length; i++) if (S.projects[i]) S.projects[i].buzz = (S.projects[i].buzz || 0) + 2;
    }
    if (S.crisis.choicePending && !S.pending) ev2CrisisChoice();
  }
  if (S.tv && S.tv.streamer && !S.pending && chance(0.06)) {
    var st = S.tv.streamer;
    S.pending = {
      type: "subwar", title: "⚔️ Subscription war", platform: st.name,
      text: "A rival platform is undercutting " + st.name + " with a discount blitz.",
      options: [
        { label: "Match their discount", note: "+$10M cost, keep subs", cost: 10 },
        { label: "Exclusives blitz", note: "$4M, subs +0.5M", cost: 4 },
        { label: "Ignore", note: "lose 8% subs" }
      ]
    };
    log("⚔️ A rival platform attacks " + st.name + " with a discount blitz.", "bad", "⚔️");
  }
}

/* ── actions: desk plan seg + pending-opt resolution ──────────── */
function events2Action(a, elx) {
  ev2Ensure();
  if (a === "pending-opt") {
    var pd = S.pending;
    if (!pd) return false;
    var idx = parseInt(elx && elx.getAttribute ? elx.getAttribute("data-idx") : "", 10);
    if (!isFinite(idx)) return false;
    if (pd.type === "awards") ev2AwardOpt(idx, pd);
    else if (pd.type === "crisis") ev2CrisisOpt(idx);
    else if (pd.type === "subwar") ev2SubwarOpt(idx);
    else return false; /* not our pending — let ui fall through */
    S.pending = null;
    saveGame();
    if (typeof closeSheet === "function") closeSheet();
    if (typeof render === "function") render();
    if (typeof drainFlash === "function") drainFlash();
    return true;
  }
  if (a === "ev2-plan") {
    var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : "";
    if (!EV2_PLANS[key]) return true;
    if (S.ev2.plan !== key) {
      S.ev2.plan = key;
      ev2Hist("Premiere plan set: " + EV2_PLANS[key].name + ".");
      saveGame();
      if (typeof render === "function") render();
    }
    return true;
  }
  return false;
}

/* ── desks ────────────────────────────────────────────────────── */
function ev2PremiereDesk() {
  ev2Ensure();
  var html = '<div class="card">'
    + '<div class="statrow"><span class="k">Plan for future releases</span><span class="v">' + esc(EV2_PLANS[S.ev2.plan].name) + "</span></div>"
    + '<div class="statrow"><span class="k">Premieres held</span><span class="v num">' + Object.keys(S.ev2.applied).length + "</span></div>"
    + "</div>";
  html += '<div class="sechead"><h2>Choose a plan</h2></div>';
  html += '<div class="card"><div class="seg">';
  var keys = ["none", "standard", "grand"];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], pl = EV2_PLANS[k];
    html += '<button data-action="ev2-plan" data-key="' + k + '"' + (S.ev2.plan === k ? ' class="on"' : "") + ">" + esc(pl.name) + "</button>";
  }
  html += "</div></div>";
  var cur = EV2_PLANS[S.ev2.plan];
  var note = S.ev2.plan === "none"
    ? "Films open without a studio event."
    : S.ev2.plan === "standard"
      ? "Standard premiere · " + fm(cur.cost) + " — opening +4% (the premiere buzz), rep +1."
      : "Grand gala · " + fm(cur.cost) + " — opening +8% (festival-grade buzz), rep +2, fans camp the carpet.";
  html += '<div class="card"><div class="statrow"><span class="k">Effect</span><span class="v">' + note + "</span></div>"
    + '<div class="statrow"><span class="k">Cost when a film releases</span><span class="v num">' + (cur.cost ? fm(cur.cost) : "—") + "</span></div>"
    + '<div class="statrow"><span class="k">Cash</span><span class="v num">' + fm(S.studio.cash) + "</span></div></div>";
  return html;
}

function ev2LogDesk() {
  ev2Ensure();
  if (!S.ev2.history.length) return '<div class="empty"><span class="em">📜</span>No events yet — premieres, award nights and crises land here.</div>';
  var html = "";
  for (var i = 0; i < S.ev2.history.length; i++) {
    var e = S.ev2.history[i];
    html += '<div class="statrow"><span class="k">W' + e.w + '</span><span class="v">' + esc(e.t) + "</span></div>";
  }
  return html;
}

var EVENTS2_DESKS = [
  { id: "ev2-premiere", group: "Events", icon: "🎬", name: "Premiere plans", desc: "Pick the studio event for future releases — none, a standard premiere or a grand gala opening.", render: ev2PremiereDesk },
  { id: "ev2-log", group: "Events", icon: "📜", name: "Event log", desc: "A running record of the studio's events — premieres, award nights, crisis years and platform wars.", render: ev2LogDesk }
];
