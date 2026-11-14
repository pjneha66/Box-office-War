"use strict";
/* game/world.js — wave 6 world sim: rival storylines, star scandal sagas, museum.
   State: S.world (lazy ensure). Systems:
   - Rival storylines: one active arc at a time; every ~10 weeks a random rival gets
     a FEUD (6 wks, wk-3 choice) / ALLIANCE (6 wks) / TAKEOVER (8 wks, wk-4 choice).
     Choices arrive as S.pending = { type:"storyline", arc:... } resolved by
     worldAction("pending-opt"). Relations per rival live in S.world.rel (-100..100).
   - Star scandal arcs: 4-week tabloid sagas on a market power>=4 star, 10%/wk start,
     wk-4 choice (PR cleanup / let it burn).
   - Museum: $50M build, weekly earn 0.2 + 0.05 per award/milestone.
   Note for integrator: ui.js bridges worldAction (desk actions + pending-opt), but
   engine.js does not call tickWorld yet and collectDesks does not concat WORLD_DESKS —
   the weekly sim and the two World desks go live once those land; the test drives
   tickWorld and worldAction directly until then. */

/* ── state ────────────────────────────────────────────────────── */
function wEnsure() {
  if (S.world) return;
  S.world = { rel: {}, nextArc: 9, arc: null, star: null, museum: null, awardWins: 0, awardYear: 0, ddWeek: 0, history: [], lastTick: 0 };
}
function wRel(name) { return S.world.rel[name] || 0; }
function wRelAdd(name, d) { S.world.rel[name] = clamp(wRel(name) + d, -100, 100); }
function wHist(txt) { S.world.history.unshift({ w: S.studio.week, t: txt }); if (S.world.history.length > 6) S.world.history.length = 6; }
function wRival(name) { var i; for (i = 0; i < S.rivals.length; i++) if (S.rivals[i].name === name) return S.rivals[i]; return null; }
function wRow(k, v, cls) { return '<div class="statrow"><span class="k">' + k + '</span><span class="v' + (cls ? " " + cls : "") + '">' + v + "</span></div>"; }

/* ── (1) rival storylines ─────────────────────────────────────── */
var W_FEUD_NEWS = [
  "{r} trashes your slate in a trade interview — the feud is public.",
  "{r} poaches a marketing exec and briefs reporters on your misses.",
  "{r} books a tentpole directly against your next wide release.",
  "{r} runs attack ads mocking your studio's recent flops.",
  "The {r} feud dominates the trades — exhibitors ask for calm.",
  "{r} and your studio snub each other at an industry gala."
];
var W_ALLY_NEWS = [
  "{r} praises your slate in an interview — the alliance is public.",
  "{r} shares audience research from their overseas markets.",
  "{r} lends your post team their colorist during a crunch.",
  "A joint charity premiere with {r} makes the society pages.",
  "{r} quietly steers a clearance deal your way.",
  "The {r} alliance holds — rivals grumble about the bloc."
];
var W_TAKEOVER_NEWS = [
  "Bankers whisper that {r} is raising an acquisition war chest.",
  "{r} tours your backlot 'for a location scout'. Nobody believes it.",
  "A leak names your studio as {r}'s next acquisition target.",
  "{r} buys a stake in a supplier you both depend on.",
  "Your board demands a response to {r}'s advances.",
  "{r} submits paperwork hinting at a hostile overture.",
  "Proxy advisors publish a dossier on a possible {r} merger.",
  "The {r} takeover saga reaches a fever pitch in the press."
];
var W_STAR_NEWS = [
  "Tabloids photograph {s} leaving a party at 4am. Mild chatter.",
  "A 'sources say' piece about {s} goes wide. Agents return calls.",
  "A late-night host mocks {s} — the saga has a soundtrack now.",
  "The {s} saga hits magazine covers. Someone must respond."
];

function wStartArc() {
  var r = pick(S.rivals), kind = pick(["feud", "alliance", "takeover"]);
  S.world.arc = { kind: kind, rival: r.name, w0: S.studio.week, el: 0, awaiting: false, resolved: false, ignored: false };
  if (kind === "feud") {
    wRelAdd(r.name, -8);
    log("⚔️ A public feud with " + r.name + " erupts — six weeks of mudslinging ahead.", "bad", "⚔️");
    wHist("Feud began with " + r.name + ".");
  } else if (kind === "alliance") {
    wRelAdd(r.name, 20);
    log("🤝 An alliance with " + r.name + " is announced — six weeks of joint goodwill.", "good", "🤝");
    wHist("Alliance began with " + r.name + ".");
  } else {
    log("🏦 Bankers whisper that " + r.name + " is weighing a takeover run at your studio.", "bad", "🏦");
    wHist("Takeover scare began with " + r.name + ".");
  }
}
function wEndArc(txt, kind) {
  var arc = S.world.arc;
  if (txt) log(txt, kind || "", "🗞️");
  if (txt) wHist(txt);
  S.world.arc = null;
}
function wOfferChoice(arc, title, text, options) {
  if (S.pending) { arc.awaiting = true; return; }
  arc.awaiting = false;
  S.pending = { type: "storyline", arc: arc.kind, rival: arc.rival, title: title, text: text, options: options };
  log("🗞️ " + title + " — the board needs a decision.", "", "🗞️");
}
function wFeudTick(arc) {
  var r = wRival(arc.rival);
  log(W_FEUD_NEWS[Math.min(arc.el, W_FEUD_NEWS.length) - 1].replace("{r}", r ? r.name : arc.rival), "bad", "⚔️");
  if (!arc.resolved && (arc.el === 3 || arc.awaiting)) {
    wOfferChoice(arc, "⚔️ Feud with " + arc.rival,
      "Week three of the feud and the trades want a answer. How do you play it?",
      [
        { label: "Public truce", cost: 4, note: "+20 relations, arc ends" },
        { label: "Escalate", note: "50% they blink" },
        { label: "Double down", note: "your films -5% this week" }
      ]);
  }
  if (arc.el >= 6) wEndArc("The " + arc.rival + " feud quietly ends — the trades move on.");
}
function wFeudOpt(idx) {
  var arc = S.world.arc;
  if (idx === 0) {
    spend(4, "Feud truce · " + arc.rival);
    wRelAdd(arc.rival, 20);
    wEndArc("A public truce with " + arc.rival + " is signed over cocktails. Relations +20.", "good");
  } else if (idx === 1) {
    if (chance(0.5)) {
      wRelAdd(arc.rival, 10);
      wEndArc(arc.rival + " blinks first and backs down. Relations +10.", "good");
    } else {
      wRelAdd(arc.rival, -12);
      log("⚔️ " + arc.rival + " does not blink — the feud turns nastier. Relations -12.", "bad", "⚔️");
      arc.resolved = true;
    }
  } else {
    /* week's grosses already landed when the choice is answered — dock the next
       processed week's rentals by 5% once, via S.world.ddWeek */
    S.world.ddWeek = S.studio.week + 1;
    log("⚔️ You double down — your films in release will run 5% soft this week.", "bad", "⚔️");
    arc.resolved = true;
  }
}
function wTakeoverTick(arc) {
  var r = wRival(arc.rival);
  log(W_TAKEOVER_NEWS[Math.min(arc.el, W_TAKEOVER_NEWS.length) - 1].replace("{r}", r ? r.name : arc.rival), "bad", "🏦");
  if (!arc.resolved && (arc.el === 4 || arc.awaiting)) {
    wOfferChoice(arc, "🏦 " + arc.rival + " takeover watch",
      "The threat is real enough to land on the board agenda. Respond how?",
      [
        { label: "Defensive merger", cost: 30, note: "relations +30, threat ends" },
        { label: "Poach staff", cost: 12, note: "their power -0.1, threat ends" },
        { label: "Ignore", note: "40%: streamer subs ×0.9, else rep -5" }
      ]);
  }
  if (arc.el >= 8) {
    if (arc.ignored) {
      if (chance(0.4)) {
        if (S.tv && S.tv.streamer) {
          S.tv.streamer.subs = Math.max(0.1, S.tv.streamer.subs * 0.9);
          log("🏦 The takeover fight bled " + S.tv.streamer.name + " — subscribers ×0.9.", "bad", "🏦");
        } else {
          S.studio.rep = clamp(S.studio.rep - 5, 0, 100);
          log("🏦 The takeover saga ends with your reputation dented — rep -5.", "bad", "🏦");
        }
        wEndArc("");
      } else wEndArc("The " + arc.rival + " takeover talk dies down — you rode it out.", "good");
    } else wEndArc("The " + arc.rival + " takeover scare is resolved — the press moves on.");
  }
}
function wTakeoverOpt(idx) {
  var arc = S.world.arc, r = wRival(arc.rival);
  if (idx === 0) {
    spend(30, "Defensive merger · " + arc.rival);
    wRelAdd(arc.rival, 30);
    wEndArc("A defensive merger with " + arc.rival + " is announced. Relations +30.", "good");
  } else if (idx === 1) {
    spend(12, "Staff poaching · " + arc.rival);
    if (r) r.power = clamp(r.power - 0.1, 0.2, 2);
    wEndArc("You gut " + arc.rival + "'s development staff — their power drops 0.1.", "good");
  } else {
    arc.ignored = true;
    arc.resolved = true;
    log("🏦 You call " + arc.rival + "'s bluff and ignore the takeover talk.", "", "🏦");
  }
}
function wAllyTick(arc) {
  var r = wRival(arc.rival);
  log(W_ALLY_NEWS[Math.min(arc.el, W_ALLY_NEWS.length) - 1].replace("{r}", r ? r.name : arc.rival), "good", "🤝");
  if (arc.el >= 6) wEndArc("The " + arc.rival + " alliance winds down on good terms.");
}
function wArcTick() {
  var arc = S.world.arc;
  if (!arc) {
    if (S.studio.week >= S.world.nextArc) {
      wStartArc();
      S.world.nextArc = S.studio.week + 9 + ri(0, 3);
    }
    return;
  }
  arc.el++;
  if (arc.kind === "feud") wFeudTick(arc);
  else if (arc.kind === "alliance") wAllyTick(arc);
  else wTakeoverTick(arc);
}

/* ── (2) star scandal arcs ────────────────────────────────────── */
function wStartStar(tid) {
  wEnsure();
  var t = findTalent(tid);
  if (!t || S.world.star) return false;
  S.world.star = { tid: tid, w0: S.studio.week, el: 0, awaiting: false, resolved: false };
  log("📰 Tabloids circle " + t.n + " — a four-week saga begins.", "bad", "📰");
  wHist("Tabloid saga: " + t.n + ".");
  return true;
}
function wStarTick() {
  var st = S.world.star, t;
  if (!st) {
    var stars = [], i;
    for (i = 0; i < S.market.length; i++) if (S.market[i].power >= 4) stars.push(S.market[i]);
    if (!stars.length || !chance(0.10)) return;
    wStartStar(pick(stars).id);
    return;
  }
  t = findTalent(st.tid);
  if (!t) { S.world.star = null; return; }
  st.el++;
  log(W_STAR_NEWS[Math.min(st.el, W_STAR_NEWS.length) - 1].replace("{s}", t.n), "bad", "📰");
  if (!st.resolved && (st.el === 4 || st.awaiting)) {
    if (!S.pending) {
      st.awaiting = false;
      S.pending = {
        type: "storyline", arc: "star", tid: st.tid,
        title: "📰 Tabloid saga: " + t.n,
        text: "Week four and the story will not die. Manage it or let it run.",
        options: [
          { label: "PR cleanup", cost: 2, note: "star heat -1, saga ends" },
          { label: "Let it burn", note: "followers -30%" }
        ]
      };
    } else st.awaiting = true;
  }
  if (st.el >= 8 && !st.resolved) { /* never answered — the saga burns out on its own */
    if (t.followersK) t.followersK = Math.round(clamp(t.followersK * 0.7, 1, 5000) * 10) / 10;
    S.world.star = null;
    log("📰 The " + t.n + " saga burns out unmanaged.", "bad", "📰");
  }
}
function wStarOpt(idx, pd) {
  var t = findTalent(pd.tid);
  if (!t) return;
  if (idx === 0) {
    spend(2, "PR cleanup · " + t.n);
    t.heat = Math.max(0, (t.heat || 0) - 1);
    log("📰 The PR team scrubs the " + t.n + " saga — heat down, story dies.", "good", "📰");
    wHist("PR cleanup for " + t.n + ".");
  } else {
    if (t.followersK) {
      t.followersK = Math.round(clamp(t.followersK * 0.7, 1, 5000) * 10) / 10;
      log("📰 You let the " + t.n + " saga burn — their following sheds 30%.", "bad", "📰");
    } else {
      log("📰 You let the " + t.n + " saga burn — no measurable follower damage.", "", "📰");
    }
    wHist("Let the " + t.n + " saga burn.");
  }
  S.world.star = null;
}

/* ── (3) museum ───────────────────────────────────────────────── */
function worldAwardCount() { return Object.keys(S.stats.milestones || {}).length + S.world.awardWins; }
function worldMuseumRate() { return Math.round((0.2 + 0.05 * worldAwardCount()) * 100) / 100; }

/* ── weekly tick (integrator wiring; lastTick-guarded) ────────── */
function wDoubledownTick() {
  if (!S.world.ddWeek || S.world.ddWeek !== S.studio.week) return;
  S.world.ddWeek = 0;
  var docked = 0, i, f, g;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "run" || !f.weekly || !f.weekly.length) continue;
    g = f.weekly[f.weekly.length - 1];
    if (!(g > 0)) continue;
    f.dom = Math.round((f.dom - g * 0.05) * 10) / 10;
    docked += g * 0.05 * 0.52;
  }
  if (docked > 0) {
    spend(docked, "Feud retaliation at the box office");
    log("⚔️ The feud cost your films 5% of the week's gross — " + fm(docked * 0.52) + " in rentals.", "bad", "⚔️");
  }
}
function wAwardCaptureTick() {
  /* engine yearAwards clears S.yearOfFilms after naming Best Picture; when tickWorld
     runs before it (woy 52), the year had a winner iff any film hit quality >= 75 */
  if (S.world.awardYear === S.studio.year) return;
  if (woyOf(S.studio.week) !== WEEKS_PER_YEAR || !S.yearOfFilms.length) return;
  var i, f, won = false;
  for (i = 0; i < S.yearOfFilms.length; i++) {
    f = findFilm(S.yearOfFilms[i]);
    if (f && f.quality >= 75) won = true;
  }
  S.world.awardYear = S.studio.year;
  if (won) {
    S.world.awardWins++;
    log("🏛️ The museum acquires a Best Picture exhibit from this year's ceremony.", "gold", "🏛️");
  }
}
function tickWorld() {
  wEnsure();
  if (S.world.lastTick === S.studio.week) return;
  S.world.lastTick = S.studio.week;
  wDoubledownTick();
  if (S.world.museum) earn(worldMuseumRate(), "Museum admissions");
  wAwardCaptureTick();
  wArcTick();
  wStarTick();
}

/* ── actions: desk buttons + pending-opt resolution ───────────── */
function worldAction(a, elx) {
  wEnsure();
  if (a === "pending-opt") {
    var pd = S.pending;
    if (!pd || pd.type !== "storyline") return false;
    var idx = parseInt(elx && elx.getAttribute ? elx.getAttribute("data-idx") : "", 10);
    if (!isFinite(idx) || !pd.options || !pd.options[idx]) return false;
    if (pd.options[idx].cost && S.studio.cash < pd.options[idx].cost) {
      toast("Need " + fm(pd.options[idx].cost) + " for that — cash is " + fm(S.studio.cash) + ".", "bad");
      return true;
    }
    if (pd.arc === "feud") wFeudOpt(idx);
    else if (pd.arc === "takeover") wTakeoverOpt(idx);
    else if (pd.arc === "star") wStarOpt(idx, pd);
    else return false;
    S.pending = null;
    saveGame();
    if (typeof closeSheet === "function") closeSheet();
    if (typeof render === "function") render();
    if (typeof drainFlash === "function") drainFlash();
    return true;
  }
  if (a === "world-build-museum") {
    if (S.world.museum) { toast("The museum is already open.", ""); return true; }
    if (S.studio.cash < 50) { toast("Need " + fm(50) + " to build the museum — cash is " + fm(S.studio.cash) + ".", "bad"); return true; }
    spend(50, "Studio museum");
    S.world.museum = { week: S.studio.week };
    log("🏛️ The studio museum opens its doors — costumes and curios draw a steady crowd.", "gold", "🏛️");
    wHist("Museum built for $50M.");
    saveGame();
    if (typeof render === "function") render();
    if (typeof drainFlash === "function") drainFlash();
    return true;
  }
  return false;
}

/* forecast hook: the museum earns via earn() in tickWorld; ui.js's forecastAdjust
   aggregator predates wave 6 and does not call forecastAdjust_world — kept uniform */
function forecastAdjust_world() { return 0; }

/* ── desks ────────────────────────────────────────────────────── */
function wStoryDesk() {
  wEnsure();
  var html = '<div class="card">', arc = S.world.arc, len = 0, i, v;
  if (arc) {
    len = arc.kind === "takeover" ? 8 : 6;
    html += wRow("Active storyline", esc(arc.kind) + " · " + esc(arc.rival) + " · week " + Math.min(arc.el, len) + " of " + len, arc.kind === "alliance" ? "up" : "down");
  } else {
    html += wRow("Next storyline window", "week " + Math.max(S.world.nextArc - S.studio.week, 0) + " away", "");
  }
  if (S.pending && S.pending.type === "storyline") html += wRow("Awaiting your decision", esc(S.pending.title), "down");
  html += "</div>";
  html += '<div class="sechead"><h2>Rival relations</h2></div><div class="card">';
  for (i = 0; i < S.rivals.length; i++) {
    v = wRel(S.rivals[i].name);
    html += wRow(esc(S.rivals[i].name), (v > 0 ? "+" : "") + Math.round(v), v >= 20 ? "up" : v <= -20 ? "down" : "");
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Recent storylines</h2></div><div class="card">';
  if (!S.world.history.length) {
    html += '<div class="empty"><span class="em">🌍</span>No storylines yet — the first feud or alliance lands around week ' + Math.max(S.world.nextArc, 9) + '.</div>';
  } else {
    for (i = 0; i < S.world.history.length; i++) {
      html += wRow("W" + S.world.history[i].w, esc(S.world.history[i].t), "");
    }
  }
  html += "</div>";
  return html;
}
function wMuseumDesk() {
  wEnsure();
  var html = '<div class="card">';
  if (!S.world.museum) {
    html += wRow("Studio museum", "not built", "down");
    html += wRow("Build cost", fm(50), "");
    html += wRow("Cash after build", fm(S.studio.cash - 50), "");
    html += '<div class="btnrow"><button class="btn primary" data-action="world-build-museum"' + (S.studio.cash < 50 ? " disabled" : "") + ">Build museum " + fm(50) + "</button></div>";
    html += "</div>";
    html += '<div class="card"><div class="empty"><span class="em">🏛️</span>A museum earns ' + fm(0.2) + " a week plus " + fm(0.05) + " per award and milestone your studio collects.</div></div>";
    return html;
  }
  html += wRow("Museum admissions", "+" + fm(worldMuseumRate()) + " / week", "up");
  html += wRow("Opened", "week " + S.world.museum.week, "");
  html += "</div>";
  html += '<div class="sechead"><h2>Exhibits</h2></div><div class="card">';
  var first = S.films.length ? S.films[S.films.length - 1] : null;
  var hit = null, flop = null, i, f;
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.ww != null && (!hit || f.ww > hit.ww)) hit = f;
    if (f.profit != null && (!flop || f.profit < flop.profit)) flop = f;
  }
  html += wRow("First film", first ? esc(first.title) + " · " + fm(first.opening) + " opening" : "—", "");
  html += wRow("Biggest hit", hit ? esc(hit.title) + " · " + fm(hit.ww) + " worldwide" : "—", hit ? "up" : "");
  html += wRow("Biggest flop", flop ? esc(flop.title) + " · " + fm(flop.profit) + " net" : "—", flop ? "down" : "");
  html += wRow("Best Picture exhibits", String(S.world.awardWins), "");
  html += wRow("Milestones", String(Object.keys(S.stats.milestones || {}).length), "");
  html += "</div>";
  return html;
}
var WORLD_DESKS = [
  { id: "world-story", group: "World", icon: "🌍", name: "Rival storylines", desc: "Feuds, alliances and takeover scares play out with the rival studios — and your relations with each of them.", render: wStoryDesk },
  { id: "world-museum", group: "World", icon: "🏛️", name: "Studio museum", desc: "Build a museum on the lot — it earns weekly admissions and exhibits your first film, biggest hit, biggest flop and trophies.", render: wMuseumDesk }
];
