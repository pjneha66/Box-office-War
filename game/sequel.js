/* Box Office War — rebuilt. Sequel planning module — all state under S.sequel.
   Systems: qualifying films (a finished run with ww >= cost x 1.8 and critic-proof
   quality 60+) can be turned into a planned sequel for an up-front development fee;
   the plan ages week by week, follows the project through production, and is consumed
   the moment the sequel is released. Pre-planning pays off with a craft bonus and an
   opening boost that decays as a franchise racks up more entries (sequel fatigue).

   GREENLIGHT / S.ideas CONTRACT (documented per HOOK-SPEC-v46 Module 2):
     "sequel-greenlight" does NOT hand-build a script object. It calls the engine's
     genIdea(franchiseRoot) — which already applies the engine's 2.5x sequel script
     price and stamps idea.franchiseOf — then pushes that one returned idea into
     S.ideas and records the plan entry. The module never splices S.ideas otherwise;
     the only other touch is re-listing a still-unused plan idea after the engine's
     14-week desk sweep prunes it (paid-for development should not evaporate).

   Wiring: the integrator calls tickSequel() from advanceWeek(), sequelOnRelease(f)
   from releaseFilm(), bridges sequelAction() in ui.js onAction() and appends
   SEQUEL_DESKS in collectDesks(); the engine multiplies expectedOpening() by
   sequelOpenMult(p) and adds sequelCraftMod(p) at computeQuality. No self-wiring.
   Every tick is idempotent per week via lastTick, so it is safe whether or not the
   engine hook exists yet. */
"use strict";

var SEQUEL_DEV_MIN = 2;
var SEQUEL_DEV_MAX = 45;
var SEQUEL_BASE_BOOST = 0.20;
var SEQUEL_FATIGUE_STEP = 0.055;
var SEQUEL_MIN_BOOST = 0.03;

/* ── state (lazy ensure — old saves have no S.sequel) ─────────── */
function sequelEnsure() {
  if (!S) return;
  if (!S.sequel) {
    S.sequel = { lastTick: 0, plans: [], shipped: {}, devSpend: 0, shippedTotal: 0, consumed: 0 };
  }
  if (!S.sequel.plans) S.sequel.plans = [];
  if (!S.sequel.shipped) S.sequel.shipped = {};
  if (!isFinite(S.sequel.devSpend)) S.sequel.devSpend = 0;
  if (!isFinite(S.sequel.shippedTotal)) S.sequel.shippedTotal = 0;
  if (!isFinite(S.sequel.consumed)) S.sequel.consumed = 0;
  if (!isFinite(S.sequel.lastTick)) S.sequel.lastTick = 0;
}

/* Franchise keys are case/space-insensitive so "Test Saga" and "test saga "
   share one fatigue ledger and one set of plan lookups. */
function sequelKey(name) {
  if (name == null) return "";
  return String(name).replace(/^\s+|\s+$/g, "").toLowerCase();
}
function sequelShippedCount(franchise) {
  if (!S || !S.sequel || !S.sequel.shipped) return 0;
  var n = S.sequel.shipped[sequelKey(franchise)];
  return isFinite(n) ? n : 0;
}
function sequelRootOf(f) {
  if (!f) return "";
  return f.franchiseOf || f.title || "";
}

/* ── plan lookup ──────────────────────────────────────────────── */
function sequelFindPlan(id) {
  if (!S || !S.sequel) return null;
  var i, p;
  for (i = 0; i < S.sequel.plans.length; i++) {
    p = S.sequel.plans[i];
    if (p.id === id) return p;
  }
  return null;
}
/* The live (unconsumed) plan for a franchise, if any. */
function sequelActivePlan(franchise) {
  if (!S || !S.sequel || !S.sequel.plans) return null;
  var k = sequelKey(franchise), i, p;
  if (!k) return null;
  for (i = 0; i < S.sequel.plans.length; i++) {
    p = S.sequel.plans[i];
    if (p.status === "done") continue;
    if (sequelKey(p.franchise) === k) return p;
  }
  return null;
}
function sequelActiveCount() {
  if (!S || !S.sequel || !S.sequel.plans) return 0;
  var n = 0, i;
  for (i = 0; i < S.sequel.plans.length; i++) if (S.sequel.plans[i].status !== "done") n++;
  return n;
}

/* ── engine hooks ─────────────────────────────────────────────── */
/* Opening multiplier. Engine already grants x1.30 for any franchise project; this adds
   the *planning* edge on top, damped by how many sequels this franchise already shipped. */
function sequelOpenMult(p) {
  if (!S || !p || !p.franchiseOf) return 1;
  var plan = sequelActivePlan(p.franchiseOf);
  if (!plan) return 1;
  var n = sequelShippedCount(p.franchiseOf);
  var boost = SEQUEL_BASE_BOOST - SEQUEL_FATIGUE_STEP * n;
  if (boost < SEQUEL_MIN_BOOST) boost = SEQUEL_MIN_BOOST;
  if (plan.status === "greenlit") boost += 0.02; /* cast attached, campaign already building */
  var mult = 1 + boost;
  return (isFinite(mult) && mult > 0) ? Math.round(mult * 1000) / 1000 : 1;
}
/* Craft add: a sequel written before the cameras roll is a better film. Decays with
   fatigue too — the fifth entry in a tired franchise does not get the same care. */
function sequelCraftMod(p) {
  if (!S || !p || !p.franchiseOf) return 0;
  var plan = sequelActivePlan(p.franchiseOf);
  if (!plan) return 0;
  var n = sequelShippedCount(p.franchiseOf);
  var add = 4 - n * 0.75;
  if (add < 1) add = 1;
  return Math.round(add * 10) / 10;
}

/* Called by the engine at release with the finished film. Consumes the plan once and
   bumps the franchise's shipped counter — idempotent, so a second call for the same
   film (or a tick sweep racing the hook) cannot double count. */
function sequelOnRelease(f) {
  if (!S || !f) return false;
  sequelEnsure();
  var root = sequelRootOf(f);
  var k = sequelKey(root);
  if (!k) return false;
  var plan = sequelActivePlan(root);
  if (!plan) return false;
  if (plan.sourceId && plan.sourceId === f.id) return false;
  plan.status = "done";
  plan.filmId = f.id;
  plan.doneWeek = S.studio.week;
  S.sequel.consumed = (S.sequel.consumed || 0) + 1;
  S.sequel.shipped[k] = sequelShippedCount(root) + 1;
  S.sequel.shippedTotal = (S.sequel.shippedTotal || 0) + 1;
  log("🎬 “" + (f.title || root) + "” ships — the " + root + " franchise now stands at "
    + S.sequel.shipped[k] + " sequel(s).", "gold", "🎬");
  return true;
}

/* ── qualifying films + cost model ────────────────────────────── */
function sequelQualifies(f) {
  if (!f) return false;
  if (f.status !== "done") return false;
  if (!isFinite(f.ww) || !isFinite(f.cost) || f.cost <= 0) return false;
  if (f.ww < f.cost * 1.8) return false;
  if (!isFinite(f.quality) || f.quality < 60) return false;
  return true;
}
/* A film is off the board once a plan already cites it as its source. */
function sequelAlreadyPlanned(filmId) {
  if (!S || !S.sequel || !S.sequel.plans) return false;
  var i;
  for (i = 0; i < S.sequel.plans.length; i++) if (S.sequel.plans[i].sourceId === filmId) return true;
  return false;
}
function sequelQualifiers() {
  var out = [], i, f;
  if (!S || !S.films) return out;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!sequelQualifies(f)) continue;
    if (sequelAlreadyPlanned(f.id)) continue;
    if (sequelActivePlan(sequelRootOf(f))) continue; /* one live sequel per franchise */
    out.push(f);
  }
  return out;
}
/* Development fee: scales with the parent's budget and its worldwide take, and rises
   with each entry already shipped (a fifth go-round costs more to get right). */
function sequelDevCost(f) {
  var base = 2.5;
  if (f && isFinite(f.budget)) base += f.budget * 0.07;
  if (f && isFinite(f.ww)) base += f.ww * 0.012;
  base *= 1 + 0.12 * sequelShippedCount(sequelRootOf(f));
  return Math.round(clamp(base, SEQUEL_DEV_MIN, SEQUEL_DEV_MAX) * 10) / 10;
}
/* Projected opening for the pitch card: the parent's opening, reshaped by fatigue. */
function sequelProjectedOpen(f) {
  var open = (f && isFinite(f.opening)) ? f.opening : 0;
  var n = sequelShippedCount(sequelRootOf(f));
  var f2 = clamp(1.12 - 0.09 * n, 0.7, 1.12);
  var est = open * f2;
  if (!isFinite(est) || est < 0) est = 0;
  return Math.round(est * 10) / 10;
}

/* ── the greenlight action (pays up front, pushes the engine idea) ─ */
function sequelPlan(filmId) {
  if (!S) return { err: "No studio loaded." };
  sequelEnsure();
  var f = findFilm(filmId);
  if (!f) return { err: "Unknown film." };
  if (!sequelQualifies(f)) return { err: "“" + f.title + "” does not qualify — a sequel needs a finished run at 1.8x its cost and a quality of 60+." };
  if (sequelAlreadyPlanned(f.id)) return { err: "“" + f.title + "” already has a sequel plan." };
  var root = sequelRootOf(f);
  if (sequelActivePlan(root)) return { err: "A " + root + " sequel is already in the pipeline." };
  var cost = sequelDevCost(f);
  if (!isFinite(cost) || cost <= 0) return { err: "Development cost could not be quoted." };
  if (S.studio.cash < cost) return { err: "Need " + fm(cost) + " for sequel development — you have " + fm(S.studio.cash) + "." };

  /* Pay first, then build the pitch with the engine's own generator so the sequel
     carries the 2.5x script price and franchiseOf stamp. */
  spend(cost, "Sequel development · " + root);
  var idea = genIdea(root);
  if (!idea || !idea.id) return { err: "Development stalled — no script came back." };
  S.ideas.unshift(idea);

  var plan = {
    id: "sq" + (S.seq++),
    franchise: root,
    key: sequelKey(root),
    sourceId: f.id,
    sourceTitle: f.title,
    genre: f.genre || (idea && idea.genre) || null,
    cost: cost,
    week: S.studio.week,
    wk: 0,
    status: "idea",
    ideaId: idea.id,
    idea: idea,
    projId: null,
    filmId: null,
    estOpen: sequelProjectedOpen(f)
  };
  S.sequel.plans.push(plan);
  S.sequel.devSpend = Math.round((S.sequel.devSpend + cost) * 10) / 10;
  log("🎬 Sequel development approved: " + root + " for " + fm(cost) + " — “" + idea.title
    + "” is on the development desk (script priced at the sequel rate).", "gold", "🎬");
  toast("🎬 " + root + " sequel developed for " + fm(cost) + ".", "good");
  return { ok: true, planId: plan.id, cost: cost, ideaId: idea.id, idea: idea };
}

/* Drop a plan: the script leaves the desk, the fee is gone (development is sunk). */
function sequelDropPlan(planId) {
  if (!S) return { err: "No studio loaded." };
  sequelEnsure();
  var plan = sequelFindPlan(planId), i;
  if (!plan) return { err: "Unknown sequel plan." };
  if (plan.status === "done") return { err: "That sequel already shipped." };
  if (plan.projId) return { err: "That sequel is already in production — finish or shelve the film itself." };
  if (plan.ideaId) {
    for (i = S.ideas.length - 1; i >= 0; i--) {
      if (S.ideas[i] && S.ideas[i].id === plan.ideaId) S.ideas.splice(i, 1);
    }
  }
  S.sequel.plans.splice(S.sequel.plans.indexOf(plan), 1);
  log("🗑️ The " + plan.franchise + " sequel script is shelved — " + fm(plan.cost) + " of development written off.", "", "🗑️");
  toast("Sequel plan dropped.", "");
  return { ok: true };
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
function tickSequel() {
  if (!S || S.over) return;
  sequelEnsure();
  if (S.sequel.lastTick === S.studio.week) return; /* double-tick guard */
  S.sequel.lastTick = S.studio.week;
  var i, j, plan, idea, p, f, linked = 0, logs = 0;

  for (i = 0; i < S.sequel.plans.length; i++) {
    plan = S.sequel.plans[i];
    if (plan.status === "done") continue;
    plan.wk = (isFinite(plan.wk) ? plan.wk : 0) + 1;

    /* keep the paid-for script on the desk: the engine prunes ideas after 14 weeks */
    if (plan.status === "idea" && plan.idea && plan.ideaId) {
      var present = false;
      for (j = 0; j < S.ideas.length; j++) if (S.ideas[j] && S.ideas[j].id === plan.ideaId) { present = true; break; }
      if (!present) {
        plan.idea.born = S.studio.week;
        S.ideas.unshift(plan.idea);
      }
    }

    /* follow the project through production; catch releases if the release hook is missing */
    if (!plan.projId) {
      for (j = 0; j < S.projects.length; j++) {
        p = S.projects[j];
        if (p && sequelKey(p.franchiseOf) === plan.key) { plan.projId = p.id; break; }
      }
    }
    if (!plan.projId && !plan.filmId) {
      for (j = 0; j < S.films.length; j++) {
        f = S.films[j];
        if (!f || sequelKey(f.franchiseOf) !== plan.key) continue;
        if (f.id === plan.sourceId) continue;
        if (plan.sourceId && isFinite(f.releaseWeek) && isFinite(plan.week) && f.releaseWeek <= plan.week) continue;
        plan.filmId = f.id;
        plan.status = "greenlit";
        break;
      }
    } else if (plan.projId && !plan.filmId) {
      var still = findProject(plan.projId);
      if (!still) {
        /* the project left S.projects — it either released or was cancelled */
        for (j = 0; j < S.films.length; j++) {
          f = S.films[j];
          if (f && sequelKey(f.franchiseOf) === plan.key && f.id !== plan.sourceId) { plan.filmId = f.id; break; }
        }
      }
    }
    if (plan.projId && plan.status === "idea") { plan.status = "greenlit"; linked++; }
    /* released already? consume through the same path the engine hook uses */
    if (plan.filmId) {
      var rel = findFilm(plan.filmId);
      if (rel && sequelOnRelease(rel) && logs < 1) logs++;
    }
  }
  if (linked > 0 && logs < 1) {
    log("🎬 A planned sequel moved into production — the franchise pipeline is running.", "", "🎬");
  }
}

/* ── commit + action delegation (ui calls sequelAction) ───────── */
function sequelCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function sequelAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("sequel-") !== 0) return false;
  sequelEnsure();
  var id = (elx && elx.getAttribute) ? elx.getAttribute("data-id") : null;
  var planId = (elx && elx.getAttribute) ? elx.getAttribute("data-plan") : null;
  var r;
  switch (a) {
    case "sequel-greenlight": r = sequelPlan(id); break;
    case "sequel-drop": r = sequelDropPlan(planId || id); break;
    default: return false;
  }
  if (r && r.err) toast(r.err, "bad");
  else sequelCommit();
  return true;
}

/* ── desk: "sequel-plan" ─────────────────────────────────────── */
function sequelStatusTag(plan) {
  if (plan.status === "done") return tag("Shipped", "green");
  if (plan.projId) return tag("In production", "gold");
  if (plan.status === "greenlit") return tag("Greenlit", "blue");
  return tag("Script on desk", "");
}

function sequelPlanDesk() {
  if (!S) return '<div class="card"><div class="empty"><span class="em">🎬</span>No studio loaded yet.</div></div>';
  sequelEnsure();
  var html = "", i, f, plan, list = sequelQualifiers(), cost, est, can, n;
  html += '<div class="card">'
    + statrow("Sequels shipped", String(S.sequel.shippedTotal || 0), (S.sequel.shippedTotal > 0 ? "up" : ""))
    + statrow("Plans in flight", String(sequelActiveCount()))
    + statrow("Development spent", fm(S.sequel.devSpend || 0))
    + statrow("Franchises tracked", String(Object.keys(S.sequel.shipped || {}).length))
    + "</div>";

  html += '<div class="sechead"><h2>Ready for a sequel</h2></div>';
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎬</span>No film qualifies yet. A finished run at 1.8x its cost with a quality of 60+ opens the door.</div></div>';
  }
  for (i = 0; i < list.length && i < 6; i++) {
    f = list[i];
    cost = sequelDevCost(f);
    est = sequelProjectedOpen(f);
    can = S.studio.cash >= cost;
    n = sequelShippedCount(sequelRootOf(f));
    html += '<div class="card film"><div class="head"><div class="title">' + esc(f.title) + "</div>"
      + tag(fm(f.ww || 0) + " worldwide", "blue") + "</div>";
    html += '<div class="meta">' + tag("Quality " + (isFinite(f.quality) ? f.quality : 0), "green")
      + tag(genreOf(f.genre).name)
      + tag(n > 0 ? n + " sequel(s) already shipped" : "First sequel", n > 0 ? "gold" : "") + "</div>";
    html += '<div class="statrow"><span class="k">Develop the sequel · ' + fm(cost)
      + " · projected opening " + fm(est) + '</span>'
      + '<button class="btn primary sm" data-action="sequel-greenlight" data-id="' + esc(f.id) + '" '
      + (can ? "" : "disabled") + ">Plan · after " + fm(S.studio.cash - cost) + "</button></div>";
    html += "</div>";
  }

  html += '<div class="sechead"><h2>Planned sequels</h2></div>';
  if (!S.sequel.plans.length) {
    html += '<div class="card"><div class="empty"><span class="em">📝</span>Nothing planned. Development pays up front, then the script lands on the normal development desk.</div></div>';
  }
  for (i = 0; i < S.sequel.plans.length; i++) {
    plan = S.sequel.plans[i];
    html += '<div class="card film"><div class="head"><div class="title">' + esc(plan.franchise) + " sequel</div>"
      + sequelStatusTag(plan) + "</div>";
    html += '<div class="meta">' + tag("Planned week " + plan.week, "")
      + tag("Cost " + fm(plan.cost), "gold")
      + tag("In pipeline " + (isFinite(plan.wk) ? plan.wk : 0) + " wk", "blue") + "</div>";
    html += '<div class="statrow"><span class="k">' + esc(plan.sourceTitle || plan.franchise) + " · projected opening "
      + fm(plan.estOpen || 0) + " · " + (plan.ideaId ? "script " + esc(plan.ideaId) : "script on desk")
      + '</span>'
      + (plan.status === "done" ? '<span class="v num up">Consumed</span>'
        : (plan.projId ? '<span class="v num">In production</span>'
          : '<button class="btn sm danger" data-action="sequel-drop" data-plan="' + esc(plan.id) + '">Drop</button>'))
      + "</div>";
    html += "</div>";
  }
  return html;
}

var SEQUEL_DESKS = [
  { id: "sequel-plan", group: "Empire & Franchises", icon: "🎬", name: "Sequel planning",
    desc: "Turn a hit into a planned sequel: pay development up front, get a franchise-priced script, a craft bonus and an opening lift that fades with every entry you ship.",
    render: sequelPlanDesk }
];

/* ── achievements (merged by meta.js allAchievements()) ───────── */
var SEQUEL_ACHIEVEMENTS = [
  { id: "sequel-first-plan", tier: 1, name: "Franchise thinking",
    desc: "Develop your first planned sequel.",
    test: function (S) { return !!S.sequel && !!S.sequel.plans && S.sequel.plans.length >= 1; } },
  { id: "sequel-first-ship", tier: 1, name: "Second chapter",
    desc: "Release a sequel developed from a plan.",
    test: function (S) { return !!S.sequel && S.sequel.shippedTotal >= 1; } },
  { id: "sequel-trilogy", tier: 2, name: "Trilogy maker",
    desc: "Ship two sequels inside the same franchise.",
    test: function (S) {
      if (!S.sequel || !S.sequel.shipped) return false;
      var k;
      for (k in S.sequel.shipped) {
        if (S.sequel.shipped.hasOwnProperty(k) && S.sequel.shipped[k] >= 2) return true;
      }
      return false;
    } },
  { id: "sequel-slate", tier: 3, name: "Sequel slate",
    desc: "Ship five planned sequels across the studio.",
    test: function (S) { return !!S.sequel && S.sequel.shippedTotal >= 5; } },
  { id: "sequel-dev-50", tier: 2, name: "Development war chest",
    desc: "Spend $50M on sequel development.",
    test: function (S) { return !!S.sequel && S.sequel.devSpend >= 50; } }
];
