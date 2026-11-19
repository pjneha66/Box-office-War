/* Box Office War — rebuilt. Console platform & hardware module — all state under S.chw.
   Systems: third-party platform licences (3 devkits, each with a real install base, a
   royalty rate and a weekly revenue contribution per in-house game still selling) ·
   a first-party console programme in three paid phases (R&D → devkit toolchain → launch)
   where every phase burns cash for real weeks and rolls a genuine failure/overrun risk ·
   devkit distribution to the studio's own game teams (royalty-free first-party shipping)
   · and hardware royalties that third-party publishers pay every week once the console
   is on shelves.
   MONEY MODEL (pick-one, documented): tickConsoleHW() CREDITS both streams itself —
   platform-edition revenue on in-house game sales and the weekly hardware royalty — and
   returns the royalty amount it actually booked. chwRoyaltyWk() is the royalty the tick
   will pay this week (0 before launch); it is NOT a second credit, do not add it again.
   chwPlatformMult() is the multiplier tickConsoleHW() applies to in-house game revenue
   (1 when nothing is licensed); the integrator must not multiply games.js sales by it as
   well or the platform uplift double-counts.
   Wiring: integrator calls tickConsoleHW() inside advanceWeek(), bridges
   consolehwAction() in ui.js onAction() and appends CONSOLE_DESKS in collectDesks().
   No self-wiring. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var CHW_PLATFORMS = [
  { id: "kinetix", name: "Kinetix Home", kind: "Home console", base: 42, cost: 6, roy: 0.15,
    blurb: "Living-room powerhouse with a paid-online install base." },
  { id: "pocketlynx", name: "PocketLynx", kind: "Handheld", base: 26, cost: 4.5, roy: 0.12,
    blurb: "Family handheld — cheap ports, long tails." },
  { id: "openstore", name: "OpenDeck Store", kind: "PC storefront", base: 90, cost: 2, roy: 0.08,
    blurb: "Open desktop storefront, lowest cut, widest reach." }
];
/* Phases of the first-party programme. Weeks are real; cost is real; risk is a live roll. */
var CHW_STAGES = [
  { id: "rd", short: "Silicon R&D", name: "Silicon & industrial design R&D", cost: 45, weeks: 6,
    risk: 0.20, overrun: 0.18, overrunWeeks: 2, overrunCash: 12,
    blurb: "Architect the APU and the box. A failed tape-out wastes the phase." },
  { id: "devkit", short: "Devkit toolchain", name: "Devkit toolchain & SDK", cost: 30, weeks: 5,
    risk: 0.18, overrun: 0.16, overrunWeeks: 2, overrunCash: 8,
    blurb: "Compilers, certification, first-party SDK. Overruns are the norm." },
  { id: "launch", short: "Manufacture & launch", name: "Manufacturing ramp & global launch", cost: 65, weeks: 6,
    risk: 0.22, overrun: 0.20, overrunWeeks: 2, overrunCash: 18,
    blurb: "Factory slots, retail placement, launch marketing." }
];
var CHW_HW_NAME = "Lumen One";
var CHW_TEAM_COST = 5;        /* $M to kit one internal team with first-party devkits */
var CHW_MAX_TEAMS = 3;
var CHW_ROY_PER_UNIT = 0.5;   /* $M of weekly royalty per million consoles installed */
var CHW_UNIT_CAP = 40;        /* million units the install base saturates at */
var CHW_DEPOSIT = 0.25;       /* share of a phase paid when it opens */

/* ── state (lazy ensure — old saves have no S.chw) ────────────── */
function chwNewHw() {
  return { stage: 0, wk: 0, active: false, extra: 0, failed: 0, overruns: 0,
    launched: false, halted: false, units: 0, weeks: 0 };
}
function chwEnsure() {
  if (!S) return null;
  if (!S.chw) S.chw = {};
  var c = S.chw;
  if (!c.lic) c.lic = {};
  if (!c.hw) c.hw = chwNewHw();
  var hw = c.hw, i, num = ["stage", "wk", "extra", "failed", "overruns", "units", "weeks"];
  for (i = 0; i < num.length; i++) if (!isFinite(hw[num[i]])) hw[num[i]] = 0;
  if (typeof hw.active !== "boolean") hw.active = !!hw.active;
  if (typeof hw.launched !== "boolean") hw.launched = !!hw.launched;
  if (typeof hw.halted !== "boolean") hw.halted = !!hw.halted;
  if (!isFinite(c.teams)) c.teams = 0;
  if (typeof c.devkits !== "boolean") c.devkits = !!c.devkits;
  if (!isFinite(c.royalties)) c.royalties = 0;
  if (!isFinite(c.platformRev)) c.platformRev = 0;
  if (!isFinite(c.invested)) c.invested = 0;
  if (!isFinite(c.licSpend)) c.licSpend = 0;
  if (!isFinite(c.lastRoyalty)) c.lastRoyalty = 0;
  if (!isFinite(c.lastTick)) c.lastTick = 0;
  if (!isFinite(c.launchWeek)) c.launchWeek = 0;
  if (hw.stage > CHW_STAGES.length) hw.stage = CHW_STAGES.length;
  if (c.teams > CHW_MAX_TEAMS) c.teams = CHW_MAX_TEAMS;
  return c;
}

function chwR1(x) { return Math.round(x * 10) / 10; }
function chwFindPlatform(id) { var i; for (i = 0; i < CHW_PLATFORMS.length; i++) if (CHW_PLATFORMS[i].id === id) return CHW_PLATFORMS[i]; return null; }
function chwLicCount() { var c = chwEnsure(), n = 0, i; if (!c) return 0; for (i = 0; i < CHW_PLATFORMS.length; i++) if (c.lic[CHW_PLATFORMS[i].id]) n++; return n; }
function chwLicensedOn(platformId) { var c = chwEnsure(); if (!c || !platformId) return false; return !!c.lic[platformId]; }

/* A platform's reach: install base (millions) × the share the studio keeps, scaled to a
   multiplier contribution. Three licences together give ×1.42 on in-house game revenue. */
function chwReach(p) { return (p.base / 1000) * (1 - p.roy) * 3; }

/* ── exported numeric hooks ───────────────────────────────────── */
/* Revenue multiplier on the studio's own released games across licensed platforms.
   1 with nothing licensed; +0.10 once first-party devkits exist; +0.04 per kitted
   internal team; +0.10 once the studio's console is on shelves. */
function chwPlatformMult() {
  if (!S) return 1;
  var c = chwEnsure(), t = 1, i, p;
  if (!c) return 1;
  for (i = 0; i < CHW_PLATFORMS.length; i++) {
    p = CHW_PLATFORMS[i];
    if (c.lic[p.id]) t += chwReach(p);
  }
  if (c.devkits) t += 0.10;
  t += 0.04 * c.teams;
  if (c.hw.launched) t += 0.10;
  return Math.round(t * 1000) / 1000;
}

/* Weekly hardware royalty, $M. 0 before the console launches. The tick books exactly
   this amount on the week it runs, so the ledger row and this value always agree. */
function chwRoyaltyWk() {
  if (!S) return 0;
  var c = chwEnsure();
  if (!c || !c.hw.launched || !(c.hw.units > 0)) return 0;
  var amt = c.hw.units * CHW_ROY_PER_UNIT * (1 + 0.06 * chwLicCount() + 0.02 * c.teams);
  return chwR1(amt);
}

/* ── shared estimates (tick + desks read the same numbers) ───── */
/* One in-house game's weekly revenue in sales week d (1..10). Uses the games module's
   own curve when it is loaded so both systems agree; falls back to the same formula. */
function chwGameWeekly(g, d) {
  if (!g) return 0;
  if (typeof gamesWeeklyEarn === "function") return gamesWeeklyEarn(g, d);
  var q = isFinite(g.quality) ? g.quality : 40;
  var b = isFinite(g.budget) ? g.budget : 10;
  return (q / 100) * b * 0.42 * Math.pow(0.85, d - 1) * (g.boost || 1);
}
function chwLiveGames() {
  var out = [], i, g, d;
  chwEnsure();
  if (!S || !S.games || !S.games.released) return out;
  for (i = 0; i < S.games.released.length; i++) {
    g = S.games.released[i];
    if (!g || !isFinite(g.relWeek)) continue;
    d = S.studio.week - g.relWeek;
    if (d < 1 || d > 10) continue;
    out.push({ g: g, d: d, wk: chwGameWeekly(g, d) });
  }
  return out;
}
function chwPlatformWeekly() {
  var list = chwLiveGames(), m = chwPlatformMult(), t = 0, i;
  if (m <= 1.0001 || !list.length) return 0;
  for (i = 0; i < list.length; i++) t += list[i].wk;
  return chwR1(t * (m - 1));
}

/* Phase failure chance: reputation buys down the risk of a bad tape-out. */
function chwRisk(st) {
  var rep = (S && isFinite(S.studio.rep)) ? S.studio.rep : 0;
  return clamp(st.risk * (1 - clamp(rep, 0, 100) / 250), 0.04, 0.6);
}

/* ── platform edition revenue (in-house games, credited weekly) ─ */
function chwPlatformRevenue() {
  var c = chwEnsure(), m = chwPlatformMult(), list = chwLiveGames(), i, p, share, t = 0, tot = 0;
  if (!c || m <= 1.0001 || !list.length) return 0;
  for (i = 0; i < list.length; i++) t += list[i].wk;
  t = t * (m - 1);
  if (t < 0.1) return 0;
  /* split the uplift across licensed platforms so the ledger names each storefront */
  for (i = 0; i < CHW_PLATFORMS.length; i++) if (c.lic[CHW_PLATFORMS[i].id]) tot += chwReach(CHW_PLATFORMS[i]);
  if (tot <= 0) return 0;
  for (i = 0; i < CHW_PLATFORMS.length; i++) {
    p = CHW_PLATFORMS[i];
    if (!c.lic[p.id]) continue;
    share = chwR1(t * (chwReach(p) / tot));
    if (share < 0.1) continue;
    earn(share, "Platform · " + p.name);
    c.platformRev = chwR1(c.platformRev + share);
  }
  return chwR1(t);
}

/* ── hardware programme (advances on the weekly tick) ────────── */
function chwUnitsAtLaunch() {
  var rep = (S && isFinite(S.studio.rep)) ? S.studio.rep : 0;
  return Math.round((3.2 + rep * 0.05 + rf(0, 1.5)) * 10) / 10;
}
function chwGrowUnits() {
  var hw = chwEnsure().hw;
  if (!hw.launched) return 0;
  var u = hw.units + hw.units * rf(0.014, 0.024) * (1 - hw.units / CHW_UNIT_CAP);
  hw.units = Math.round(clamp(u, 0, CHW_UNIT_CAP) * 100) / 100;
  return hw.units;
}

function chwResolveStage(st) {
  var c = chwEnsure(), hw = c.hw;
  if (chance(chwRisk(st))) {
    /* the phase fails: the money is gone and the programme stalls until retried */
    hw.active = false;
    hw.halted = true;
    hw.failed++;
    hw.wk = 0;
    hw.extra = 0;
    log("💥 " + st.name + " collapsed — the phase is written off and the programme is halted. Retry it from the desk.", "bad", "💥");
    toast("💥 " + st.short + " failed. Retry from the console desk.", "bad");
    return "fail";
  }
  if (chance(st.overrun)) {
    hw.extra += st.overrunWeeks;
    hw.overruns++;
    log("⏳ " + st.name + " overruns — " + st.overrunWeeks + " more weeks and " + fm(st.overrunCash) + " of extra burn.", "", "⏳");
    return "overrun";
  }
  hw.stage++;
  hw.wk = 0;
  hw.extra = 0;
  hw.active = false;
  hw.halted = false;
  if (hw.stage <= 1) {
    log("✅ " + st.name + " is done — " + CHW_STAGES[hw.stage].name + " is cleared to open.", "good", "✅");
  } else if (hw.stage === 2) {
    c.devkits = true;
    log("🛠️ Devkit toolchain ships — the " + CHW_HW_NAME + " SDK goes to your internal teams. Own games now sell royalty-free there.", "gold", "🛠️");
    toast("🛠️ Devkits are live — first-party margin unlocked.", "gold");
  } else {
    hw.launched = true;
    hw.units = chwUnitsAtLaunch();
    c.launchWeek = S.studio.week;
    log("🚀 The " + CHW_HW_NAME + " launches with " + hw.units.toFixed(1) + "M units placed — third parties now pay you " + fm(chwRoyaltyWk()) + "/week.", "gold", "🚀");
    toast("🚀 " + CHW_HW_NAME + " is on shelves.", "gold");
  }
  return "ok";
}

function chwAdvanceHw() {
  var c = chwEnsure(), hw = c.hw, st, burn;
  if (!c || !hw.active || hw.launched) return;
  st = CHW_STAGES[hw.stage];
  if (!st) { hw.active = false; return; }
  hw.wk++;
  hw.weeks++;
  if (hw.wk > st.weeks) burn = chwR1(st.overrunCash / st.overrunWeeks);
  else burn = chwR1(st.cost * (1 - CHW_DEPOSIT) / st.weeks);
  if (burn > 0) {
    spend(burn, "Hardware · " + st.short);
    c.invested = chwR1(c.invested + burn);
  }
  if (hw.wk >= st.weeks + hw.extra) chwResolveStage(st);
}

/* ── weekly tick (engine calls this inside advanceWeek) ───────── */
/* Returns the royalty amount actually credited this week ($M, 0 before launch). */
function tickConsoleHW() {
  if (!S || S.over) return 0;
  var c = chwEnsure();
  if (!c) return 0;
  if (c.lastTick === S.studio.week) return 0; /* idempotent per week — safe under double hooks */
  c.lastTick = S.studio.week;
  chwPlatformRevenue();
  chwAdvanceHw();
  var credited = 0;
  if (c.hw.launched) {
    chwGrowUnits();
    c.hw.weeks++;
    credited = chwRoyaltyWk();
    if (credited >= 0.1) {
      earn(credited, "Hardware royalties · " + CHW_HW_NAME);
      c.royalties = chwR1(c.royalties + credited);
    } else credited = 0;
  }
  c.lastRoyalty = credited;
  return credited;
}

/* ── mechanics (return { ok } / { err }) ──────────────────────── */
function chwLicense(id) {
  var c = chwEnsure(), p = chwFindPlatform(id);
  if (!p) return { err: "Unknown platform." };
  if (c.lic[p.id]) return { err: "You already hold the " + p.name + " devkit licence." };
  if (S.studio.cash < p.cost) return { err: "Need " + fm(p.cost) + " for the " + p.name + " devkit licence." };
  spend(p.cost, "Devkit licence · " + p.name);
  c.lic[p.id] = S.studio.week;
  c.licSpend = chwR1(c.licSpend + p.cost);
  c.invested = chwR1(c.invested + p.cost);
  log("🔌 " + p.name + " devkits signed — " + fm(p.cost) + " for " + p.base + "M of install base at a " + Math.round(p.roy * 100) + "% platform cut.", "gold", "🔌");
  toast("🔌 " + p.name + " licence acquired.", "good");
  return { ok: true, cost: p.cost };
}

function chwStartStage() {
  var c = chwEnsure(), hw = c.hw, st = CHW_STAGES[hw.stage], dep;
  if (hw.launched) return { err: "The " + CHW_HW_NAME + " is already on shelves." };
  if (!st) return { err: "Nothing left to build — every phase is complete." };
  if (hw.active) return { err: st.name + " is already running." };
  if (S.studio.cash < st.cost) return { err: "Need " + fm(st.cost) + " to open the " + st.name + " phase." };
  dep = chwR1(st.cost * CHW_DEPOSIT);
  spend(dep, "Hardware deposit · " + st.short);
  c.invested = chwR1(c.invested + dep);
  hw.active = true;
  hw.halted = false;
  hw.wk = 0;
  hw.extra = 0;
  log("🛠️ " + st.name + " opens — " + fm(dep) + " committed now, " + fm(chwR1(st.cost - dep)) + " to burn over " + st.weeks + " weeks.", "", "🛠️");
  toast("🛠️ " + st.short + " underway.", "good");
  return { ok: true, deposit: dep };
}

function chwAbortStage() {
  var hw = chwEnsure().hw, st = CHW_STAGES[hw.stage];
  if (!hw.active) return { err: "No hardware phase is running." };
  hw.active = false;
  hw.halted = true;
  hw.wk = 0;
  hw.extra = 0;
  log("🛑 The " + (st ? st.name : "hardware") + " phase is halted — the deposit stays spent and nothing ships.", "bad", "🛑");
  return { ok: true };
}

function chwDeployTeam() {
  var c = chwEnsure();
  if (!c.devkits) return { err: "No devkits exist yet — finish the toolchain phase first." };
  if (c.teams >= CHW_MAX_TEAMS) return { err: "All " + CHW_MAX_TEAMS + " internal teams already hold first-party devkits." };
  if (S.studio.cash < CHW_TEAM_COST) return { err: "Need " + fm(CHW_TEAM_COST) + " to kit out an internal team." };
  spend(CHW_TEAM_COST, "Devkit rollout · internal team " + (c.teams + 1));
  c.teams++;
  c.invested = chwR1(c.invested + CHW_TEAM_COST);
  log("🧑‍💻 Internal team " + c.teams + " is kitted with first-party devkits — its games ship royalty-free on the " + CHW_HW_NAME + ".", "good", "🧑‍💻");
  toast("🧑‍💻 Devkits delivered to team " + c.teams + ".", "good");
  return { ok: true };
}

/* ── commit + action delegation (ui calls consolehwAction) ────── */
function chwCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function consolehwAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("chw-") !== 0) return false;
  chwEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var r;
  switch (a) {
    case "chw-license": r = chwLicense(id); break;
    case "chw-hw-start": r = chwStartStage(); break;
    case "chw-hw-abort": r = chwAbortStage(); break;
    case "chw-team": r = chwDeployTeam(); break;
    default: return false;
  }
  if (r && r.err) toast(r.err, "bad");
  else chwCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function chwHwStatus() {
  var hw = chwEnsure().hw, st = CHW_STAGES[hw.stage];
  if (hw.launched) return CHW_HW_NAME + " on shelves";
  if (hw.active && st) return st.short + " · week " + hw.wk + " / " + (st.weeks + hw.extra);
  if (hw.halted && st) return st.short + " halted — retry";
  if (hw.stage === 0) return "Not started";
  if (hw.stage >= CHW_STAGES.length) return "All phases complete";
  return "Phase " + hw.stage + " of " + CHW_STAGES.length + " complete";
}

function chwPlatformDesk() {
  var c = chwEnsure(), html = "", i, p, owned, can, est = chwPlatformWeekly();
  html += '<div class="card">'
    + statrow("Platforms licensed", chwLicCount() + " / " + CHW_PLATFORMS.length)
    + statrow("Revenue multiplier on our games", "\u00d7" + chwPlatformMult().toFixed(2), chwPlatformMult() > 1 ? "up" : "")
    + statrow("Platform editions this week", (est > 0 ? "+" : "") + fm(est), est > 0 ? "up" : "")
    + statrow("Devkit licences paid", fm(c.licSpend || 0))
    + "</div>";
  if (!chwLicCount()) {
    html += '<div class="card"><div class="empty"><span class="em">🔌</span>No platform licences yet. A devkit puts the whole game slate on a third-party storefront: the platform keeps its cut, you keep the reach — and the multiplier only counts while it sells.</div></div>';
  }
  html += '<div class="sechead"><h2>Third-party platforms</h2></div>';
  for (i = 0; i < CHW_PLATFORMS.length; i++) {
    p = CHW_PLATFORMS[i];
    owned = !!c.lic[p.id];
    can = S.studio.cash >= p.cost;
    html += '<div class="card film"><div class="head"><div class="title">' + esc(p.name) + "</div>"
      + tag(owned ? "Licensed" : fm(p.cost) + " devkit", owned ? "green" : "gold") + "</div>"
      + '<div class="meta">' + tag(esc(p.kind)) + tag(p.base + "M install base") + tag(Math.round(p.roy * 100) + "% royalty", "red") + "</div>"
      + '<div class="statrow"><span class="k">' + esc(p.blurb) + '</span><span class="v num">\u00d7' + (1 + chwReach(p)).toFixed(3) + " reach</span></div>";
    if (owned) {
      html += '<div class="statrow"><span class="k">Licensed week ' + c.lic[p.id] + '</span><span class="v">' + tag("Live", "green") + "</span></div>";
    } else {
      html += '<div class="statrow"><span class="k">Ships our games at a ' + Math.round(p.roy * 100) + "% platform cut</span>"
        + '<button class="btn sm" data-action="chw-license" data-id="' + p.id + '" ' + (can ? "" : "disabled") + ">License · " + fm(p.cost) + " · after " + fm(S.studio.cash - p.cost) + "</button></div>";
    }
    html += "</div>";
  }
  return html;
}

function chwHardwareDesk() {
  var c = chwEnsure(), hw = c.hw, html = "", i, st, status, can, pct;
  html += '<div class="card">'
    + statrow("Programme", esc(chwHwStatus()), hw.launched ? "up" : "")
    + statrow("Cash invested to date", fm(c.invested || 0))
    + statrow("Console install base", hw.launched ? hw.units.toFixed(1) + "M units" : "—")
    + statrow("Royalty income", hw.launched ? "+" + fm(chwRoyaltyWk()) + " / wk" : fm(0), hw.launched ? "up" : "")
    + statrow("Phases failed", String(hw.failed || 0));
  html += "</div>";
  if (hw.launched) {
    html += '<div class="sechead"><h2>On shelves</h2></div><div class="card">'
      + statrow("Launched", "week " + c.launchWeek + " · " + hw.weeks + " weeks on sale")
      + statrow("Royalties banked", fm(c.royalties || 0), "up")
      + statrow("Third parties pay per week", "+" + fm(chwRoyaltyWk()), "up")
      + "</div>";
  }
  html += '<div class="sechead"><h2>Build phases</h2></div>';
  for (i = 0; i < CHW_STAGES.length; i++) {
    st = CHW_STAGES[i];
    status = i < hw.stage ? "Complete" : (i === hw.stage && hw.active ? "Running" : (i === hw.stage && !hw.launched ? (hw.halted ? "Halted" : "Next") : "Locked"));
    html += '<div class="card film"><div class="head"><div class="title">' + esc(st.name) + "</div>"
      + tag(status, i < hw.stage ? "green" : hw.active && i === hw.stage ? "gold" : hw.halted && i === hw.stage ? "red" : "") + "</div>"
      + '<div class="meta">' + tag(fm(st.cost) + " budget") + tag(st.weeks + " weeks") + tag("failure " + Math.round(chwRisk(st) * 100) + "%", "red") + "</div>"
      + '<div class="statrow"><span class="k">' + esc(st.blurb) + "</span><span class=\"v num\">" + fm(st.overrunCash) + " overrun risk</span></div>";
    if (i === hw.stage && hw.active) {
      pct = clamp(Math.round((hw.wk / (st.weeks + hw.extra)) * 100), 3, 100);
      html += '<div class="statrow"><span class="k">Progress</span><span class="v">week ' + hw.wk + " / " + (st.weeks + hw.extra) + " · " + fm(chwR1(st.cost * (1 - CHW_DEPOSIT) / st.weeks)) + "/wk burn</span></div>"
        + '<div class="bar"><i style="width:' + pct + '%"></i></div>'
        + '<div class="btnrow"><button class="btn sm danger" data-action="chw-hw-abort">Halt phase</button></div>';
    } else if (i === hw.stage && !hw.launched) {
      can = S.studio.cash >= st.cost;
      html += '<div class="statrow"><span class="k">Stage cost</span><span class="v">' + fm(st.cost) + " · " + fm(chwR1(st.cost * CHW_DEPOSIT)) + " deposit</span></div>"
        + '<div class="btnrow"><button class="btn primary grow" data-action="chw-hw-start" ' + (can ? "" : "disabled") + ">"
        + (hw.halted ? "Retry " : "Open ") + esc(st.short) + " · " + fm(st.cost) + " · cash after " + fm(S.studio.cash - st.cost) + "</button></div>";
    }
    html += "</div>";
  }
  if (!hw.launched && hw.stage === 0 && !hw.active) {
    html += '<div class="card"><div class="empty"><span class="em">🚀</span>Build your own console: three paid phases, each burning cash over real weeks with a live failure and overrun risk. A launched console pays third-party royalties every week.</div></div>';
  }
  return html;
}

function chwDevkitDesk() {
  var c = chwEnsure(), hw = c.hw, html = "", i, list = chwLiveGames(), g, st;
  html += '<div class="card">'
    + statrow("First-party devkits", c.devkits ? "Distributed" : "Not built yet", c.devkits ? "up" : "")
    + statrow("Internal teams kitted", c.teams + " / " + CHW_MAX_TEAMS)
    + statrow("First-party margin bonus", c.devkits ? "\u00d7" + (1 + 0.10 + 0.04 * c.teams).toFixed(2) + " on our games" : "locked")
    + statrow("Platform editions this week", (chwPlatformWeekly() > 0 ? "+" : "") + fm(chwPlatformWeekly()), "up")
    + statrow("Royalties banked", fm(c.royalties || 0), "up")
    + "</div>";
  html += '<div class="sechead"><h2>Devkit rollout</h2></div><div class="card">';
  if (!c.devkits) {
    html += '<div class="statrow"><span class="k">Finish the devkit toolchain phase to hand SDKs to your own teams</span><span class="v">'
      + esc(hw.active && hw.stage === 1 ? "toolchain running" : hw.stage > 1 ? "console shipped" : "toolchain pending") + "</span></div>";
  } else {
    html += '<div class="statrow"><span class="k">Kit out an internal team · ' + fm(CHW_TEAM_COST) + " · +0.04 platform multiplier and royalty-free shipping</span>"
      + '<button class="btn sm" data-action="chw-team" ' + (c.teams >= CHW_MAX_TEAMS || S.studio.cash < CHW_TEAM_COST ? "disabled" : "") + ">Deploy · after " + fm(S.studio.cash - CHW_TEAM_COST) + "</button></div>";
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Our games on platform</h2></div>';
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎮</span>No in-house game is inside its 10-week sales window. Licensed platforms pay on every selling game — start a title in the game studio desk.</div></div>';
  }
  for (i = 0; i < list.length && i < 5; i++) {
    g = list[i].g;
    html += '<div class="card"><div class="statrow"><span class="k">' + esc(g.title || "Untitled") + " · week " + list[i].d + " of 10</span>"
      + '<span class="v num up">+' + fm(chwR1(list[i].wk * (chwPlatformMult() - 1))) + " platform</span></div></div>";
  }
  html += '<div class="sechead"><h2>Console royalty</h2></div><div class="card">';
  if (!hw.launched) {
    html += '<div class="statrow"><span class="k">No console on shelves — third-party royalties start at launch</span><span class="v">' + fm(0) + "</span></div>";
  } else {
    st = chwRoyaltyWk();
    html += '<div class="statrow"><span class="k">' + esc(CHW_HW_NAME) + " · " + hw.units.toFixed(1) + "M units · licence mix " + chwLicCount() + " / " + CHW_PLATFORMS.length + '</span><span class="v num up">+' + fm(st) + " / wk</span></div>"
      + '<div class="statrow"><span class="k">Formulated as install base \u00d7 ' + fm(CHW_ROY_PER_UNIT) + " per million \u00d7 licence and team mix</span><span class=\"v\">" + esc(CHW_HW_NAME) + "</span></div>";
  }
  html += "</div>";
  return html;
}

var CONSOLE_DESKS = [
  { id: "chw-platforms", group: "Games & hardware", icon: "🔌", name: "Platform licences",
    desc: "License devkits for third-party consoles and a PC storefront — install base, royalty rate and a real weekly cut of every in-house game still selling.",
    render: chwPlatformDesk },
  { id: "chw-hardware", group: "Games & hardware", icon: "🚀", name: "First-party console",
    desc: "Build your own console in three paid phases (R&D → devkits → launch). Each phase burns cash over real weeks and can fail or overrun.",
    render: chwHardwareDesk },
  { id: "chw-devteams", group: "Games & hardware", icon: "🧑‍💻", name: "Devkit programme",
    desc: "Distribute devkits to internal game teams so your own titles ship royalty-free, and track the weekly hardware royalty stream.",
    render: chwDevkitDesk }
];
