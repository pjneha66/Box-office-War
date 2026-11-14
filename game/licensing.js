/* Box Office War — rebuilt. Licensing module (wave 6) — all state under S.lic.
   Systems:
   · Licensing marketplace — weekly offers from buyers for finished, unlicensed
     films: Airlines (one-time 0.15% of ww, gate ww ≥ 20), Hotels (12-week
     trickle 0.02%/wk of ww, gate ww ≥ 30), TV Networks (one-time 0.25% of ww,
     gate ww ≥ 50). Up to 3 offers generated per week, max 4 open; offers expire
     3 weeks after they land. Accept earns 'Licensing · buyer · title' and marks
     the film licensed (Hotels pay through a trickle, see licTickTrickles).
   · International offices — one-shot builds in London ($30M) / Tokyo ($35M) /
     Seoul ($28M), one each. Each earns 0.2/wk 'Office income' and boosts
     regional reputation growth via officeRegionalBonus(region) (+0.5 per
     matching office: London→EU, Tokyo→APAC, Seoul→APAC).
     NOTE for integrator (already told): wire officeRegionalBonus() into
     bizdeal.js regional growth — dealWeekly should add
     officeRegionalBonus("EU"|"APAC"|"CN") on top of the per-genre +4 for the
     matching region. licensing.js does not edit bizdeal growth itself.
   Engine hooks defined here: forecastAdjust_licensing() → 0 (spec: the module's
   weekly income is not forecasted; hook kept uniform per wave-6 brief).
   Integrator wiring still pending (module side complete):
   - engine.js advanceWeek: `if (typeof tickLicensing === "function") tickLicensing();`
   - ui.js onAction: bridge licensingAction · collectDesks: concat LICENSING_DESKS
   The test drives ctx.tickLicensing() after each advanceWeek (rebuild-bizdeal
   harness pattern), so behavior here is verified either way. */
"use strict";

/* ── module data ──────────────────────────────────────────────── */
var LIC_BUYERS = [
  { id: "airlines", name: "Airlines",    rate: 0.0015, gate: 20, trickle: 0  },
  { id: "hotels",   name: "Hotels",      rate: 0.0002, gate: 30, trickle: 12 },
  { id: "tv",       name: "TV Networks", rate: 0.0025, gate: 50, trickle: 0  }
];
var LIC_OFFICES = [
  { id: "lon", name: "London", cost: 30, region: "EU" },
  { id: "tok", name: "Tokyo",  cost: 35, region: "APAC" },
  { id: "seo", name: "Seoul",  cost: 28, region: "APAC" }
];
var LIC_OFFICE_WK = 0.2;   /* $M per open office per week */
var LIC_MAX_OPEN = 4;      /* cap on simultaneously open offers */

/* ── state (lazy ensure — old saves have no S.lic) ────────────── */
function licEnsure() {
  if (!S) return;
  if (!S.lic) S.lic = { offers: [], trickles: [], offices: {}, total: 0, lastTick: null };
  if (!S.lic.offers) S.lic.offers = [];
  if (!S.lic.trickles) S.lic.trickles = [];
  if (!S.lic.offices) S.lic.offices = {};
  if (S.lic.total == null) S.lic.total = 0;
}

/* ── lookups ──────────────────────────────────────────────────── */
function licBuyerOf(id) {
  for (var i = 0; i < LIC_BUYERS.length; i++) if (LIC_BUYERS[i].id === id) return LIC_BUYERS[i];
  return null;
}
function licOfficeOf(id) {
  for (var i = 0; i < LIC_OFFICES.length; i++) if (LIC_OFFICES[i].id === id) return LIC_OFFICES[i];
  return null;
}
function licOfficeCount() {
  var n = 0, i;
  for (i = 0; i < LIC_OFFICES.length; i++) if (S.lic.offices[LIC_OFFICES[i].id]) n++;
  return n;
}

/* ── international offices ────────────────────────────────────── */
/* PURE (no ensure, no side effects): +0.5 per matching office. Integrator wires
   this into bizdeal.js regional growth (London→EU, Tokyo→APAC, Seoul→APAC). */
function officeRegionalBonus(region) {
  if (!S || !S.lic || !S.lic.offices) return 0;
  var n = 0, i;
  for (i = 0; i < LIC_OFFICES.length; i++)
    if (LIC_OFFICES[i].region === region && S.lic.offices[LIC_OFFICES[i].id]) n++;
  return n * 0.5;
}

function licBuildOffice(id) {
  licEnsure();
  var od = licOfficeOf(id);
  if (!od) return { err: "Unknown office." };
  if (S.lic.offices[od.id]) return { err: "The " + od.name + " office is already open." };
  if (S.studio.cash < od.cost) return { err: "Need " + fm(od.cost) + " to open the " + od.name + " office." };
  spend(od.cost, "Office · " + od.name);
  S.lic.offices[od.id] = true;
  log("International office opens in " + od.name + " — " + fm(LIC_OFFICE_WK) + "/wk income and faster " + od.region + " reputation growth.", "gold", "🏢");
  toast("🏢 " + od.name + " office open.", "good");
  return { ok: true };
}

/* ── offers ───────────────────────────────────────────────────── */
function licTickExpiry() {
  var i, gone = 0;
  for (i = S.lic.offers.length - 1; i >= 0; i--) {
    if (S.lic.offers[i].expires <= S.studio.week) { S.lic.offers.splice(i, 1); gone++; }
  }
  if (gone) log(gone + " licensing offer" + (gone > 1 ? "s" : "") + " expired untouched.", "", "📄");
  return gone;
}

function licTickOffers() {
  if (S.lic.offers.length >= LIC_MAX_OPEN) return 0;
  var open = {}, i, f;
  for (i = 0; i < S.lic.offers.length; i++) open[S.lic.offers[i].filmId] = true;
  /* newest finishes first — fresh hits are the licensing prize */
  var cands = [];
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (f.status !== "done" || f.licensed || open[f.id] || !isFinite(f.ww)) continue;
    cands.push(f);
  }
  cands.reverse();
  var made = 0, b, bd, buyers;
  for (i = 0; i < cands.length && made < 3 && S.lic.offers.length < LIC_MAX_OPEN; i++) {
    f = cands[i];
    buyers = [];
    for (b = 0; b < LIC_BUYERS.length; b++) {
      bd = LIC_BUYERS[b];
      if (f.ww >= bd.gate) buyers.push(bd);
    }
    if (!buyers.length) continue;
    bd = pick(buyers);
    S.lic.offers.push({
      id: "lo" + (S.seq++), filmId: f.id, buyer: bd.id,
      amt: Math.round(f.ww * bd.rate * (bd.trickle || 1) * 10) / 10,  /* total contract value */
      perWk: bd.trickle ? Math.round(f.ww * bd.rate * 10000) / 10000 : 0,
      expires: S.studio.week + 3
    });
    open[f.id] = true;
    made++;
  }
  if (made) log(made + " licensing offer" + (made > 1 ? "s" : "") + " landed on your desk — see the Licensing market.", "", "📄");
  return made;
}

function licAccept(offerId) {
  licEnsure();
  var i, o = null;
  for (i = 0; i < S.lic.offers.length; i++) if (S.lic.offers[i].id === offerId) { o = S.lic.offers[i]; break; }
  if (!o) return { err: "That offer is no longer on the table." };
  var f = findFilm(o.filmId), bd = licBuyerOf(o.buyer);
  if (!f || !bd) { S.lic.offers.splice(i, 1); return { err: "That offer no longer matches a film." }; }
  if (f.licensed) { S.lic.offers.splice(i, 1); return { err: "“" + f.title + "” is already licensed." }; }
  if (bd.trickle) {
    S.lic.trickles.push({ id: o.id, filmId: f.id, title: f.title, perWk: o.perWk, left: bd.trickle, carry: 0 });
    log("“" + f.title + "” licenses to " + bd.name + " — " + fm(o.amt) + " paid over " + bd.trickle + " weeks.", "good", "📄");
  } else {
    earn(o.amt, "Licensing · " + bd.name + " · " + f.title);
    S.lic.total += o.amt;
    log("“" + f.title + "” licenses to " + bd.name + " for " + fm(o.amt) + ".", "good", "📄");
  }
  f.licensed = true;
  f.licBuyer = bd.name;
  S.lic.offers.splice(i, 1);
  toast("📄 Licensing deal closed: " + f.title + ".", "good");
  return { ok: true };
}

function licDecline(offerId) {
  licEnsure();
  var i;
  for (i = 0; i < S.lic.offers.length; i++) {
    if (S.lic.offers[i].id === offerId) {
      S.lic.offers.splice(i, 1);
      toast("📄 Offer declined — the film stays on the market.", "");
      return { ok: true };
    }
  }
  return { err: "That offer is gone." };
}

/* ── weekly income ────────────────────────────────────────────── */
/* Hotels pay 0.02% of ww per week for 12 weeks. The ledger granularity is
   $0.1M, so dust-level weekly amounts accrue in a carry bucket and pay out in
   0.1M chunks (final week flushes the remainder, rounded). */
function licTickTrickles() {
  var i, t, pay;
  for (i = S.lic.trickles.length - 1; i >= 0; i--) {
    t = S.lic.trickles[i];
    t.carry += t.perWk;
    if (t.left <= 1) {          /* final week — flush what accrued */
      pay = Math.round(t.carry * 10) / 10;
      t.carry = 0;
    } else {
      pay = Math.floor(t.carry * 10) / 10;
      t.carry = Math.round((t.carry - pay) * 10000) / 10000;
    }
    if (pay > 0) { earn(pay, "Licensing · Hotels · " + t.title); S.lic.total += pay; }
    t.left--;
    if (t.left <= 0) S.lic.trickles.splice(i, 1);
  }
}

function licTickOffices() {
  var n = licOfficeCount();
  if (!n) return;
  earn(LIC_OFFICE_WK * n, "Office income");
  S.lic.total += LIC_OFFICE_WK * n;
}

/* ── weekly tick (engine.js advanceWeek will call tickLicensing()) ── */
function tickLicensing() {
  if (!S || S.over) return;
  licEnsure();
  if (S.lic.lastTick === S.studio.week) return; /* idempotent per week — safe under double hooks */
  S.lic.lastTick = S.studio.week;
  licTickTrickles();
  licTickOffices();
  licTickExpiry();
  licTickOffers();
}

/* forecast convention per the wave-6 brief: licensing's weekly income is not
   forecasted — the hook exists so the 12-week cashflow stays uniform. */
function forecastAdjust_licensing() { return 0; }

/* ── desk helpers ─────────────────────────────────────────────── */
function licWkFmt(x) { return x >= 0.1 ? fm(x) + "/wk" : "$" + Math.round(x * 1000) + "K/wk"; }
function licRunRate() {
  var r = 0, i;
  for (i = 0; i < S.lic.trickles.length; i++) r += S.lic.trickles[i].perWk;
  return Math.round((r + LIC_OFFICE_WK * licOfficeCount()) * 10000) / 10000;
}

function deskLicMarket() {
  licEnsure();
  var run = licRunRate();
  var html = '<div>'
    + '<div class="card">'
    + statrow("Open offers", S.lic.offers.length + " / " + LIC_MAX_OPEN)
    + statrow("Licensing income to date", fm(S.lic.total))
    + statrow("Weekly run rate (trickles + offices)", run > 0 ? licWkFmt(run) : "—", run > 0 ? "up" : "")
    + "</div>";
  html += '<div class="sechead"><h2>Offers on the table</h2></div>';
  var i, o, bd, f;
  if (!S.lic.offers.length) {
    html += '<div class="card"><div class="empty"><span class="em">📄</span>No open offers. Buyers circle your finished films every week — bigger worldwide grosses draw the big checkbooks.</div></div>';
  } else {
    for (i = 0; i < S.lic.offers.length; i++) {
      o = S.lic.offers[i]; bd = licBuyerOf(o.buyer); f = findFilm(o.filmId);
      if (!bd || !f) continue;
      html += '<div class="card">'
        + statrow(esc(bd.name) + " · “" + esc(f.title) + "”", fm(o.amt) + " " + (bd.trickle ? tag(bd.trickle + "-wk trickle", "blue") : tag("one-time", "blue")))
        + statrow("Terms", bd.trickle ? "+" + licWkFmt(o.perWk) + " for " + bd.trickle + " weeks" : "paid on signature")
        + statrow("Expires", Math.max(0, o.expires - S.studio.week) + " wk")
        + '<div class="btnrow">'
        + '<button class="btn primary sm" data-action="lic-accept" data-id="' + o.id + '">Accept</button>'
        + '<button class="btn sm" data-action="lic-decline" data-id="' + o.id + '">Decline</button>'
        + "</div>"
        + "</div>";
    }
  }
  html += '<div class="sechead"><h2>Licensed titles</h2></div>';
  var lic = [];
  for (i = 0; i < S.films.length; i++) if (S.films[i].licensed) lic.push(S.films[i]);
  if (!lic.length) {
    html += '<div class="card"><div class="empty"><span class="em">📄</span>No licensed titles yet. Every finished film without a license is on the market.</div></div>';
  } else {
    html += '<div class="card">';
    var k, t, left;
    for (i = 0; i < lic.length; i++) {
      left = 0;
      for (k = 0; k < S.lic.trickles.length; k++) if (S.lic.trickles[k].filmId === lic[i].id) left = S.lic.trickles[k].left;
      html += statrow("“" + esc(lic[i].title) + "”", esc(lic[i].licBuyer || "Licensed") + (left ? " " + tag(left + " wk left", "gold") : ""));
    }
    html += "</div>";
  }
  return html + "</div>";
}

function deskLicOffices() {
  licEnsure();
  var n = licOfficeCount();
  var html = '<div>'
    + '<div class="card">'
    + statrow("Open offices", n + " / " + LIC_OFFICES.length)
    + statrow("Office income", n ? "+" + fm(LIC_OFFICE_WK * n) + "/wk" : "—", n ? "up" : "")
    + statrow("Reputation growth bonus", "+0.5/wk per matching region")
    + "</div>"
    + '<div class="sechead"><h2>International offices</h2></div>';
  var i, od, built;
  for (i = 0; i < LIC_OFFICES.length; i++) {
    od = LIC_OFFICES[i];
    built = !!S.lic.offices[od.id];
    html += '<div class="card">'
      + statrow(esc(od.name), built ? tag("Open", "green") : fm(od.cost))
      + statrow("Effect", od.region + " reputation growth +0.5/wk · " + fm(LIC_OFFICE_WK) + "/wk income");
    if (!built) {
      html += '<div class="statrow"><span class="k">Open the ' + esc(od.name) + " office (" + fm(od.cost)
        + ")<br><small style='color:var(--faint)'>cash after " + fm(S.studio.cash - od.cost) + "</small></span>"
        + '<button class="btn primary sm" data-action="lic-office" data-id="' + od.id + '"' + (S.studio.cash < od.cost ? " disabled" : "") + ">Build</button></div>";
    }
    html += "</div>";
  }
  html += '<div class="card"><div class="empty" style="padding:8px 0 0">Offices are one-shot builds. Their regional boost is applied by the deals module as it grows EU / APAC / CN reputation each week.</div></div>';
  return html + "</div>";
}

var LICENSING_DESKS = [
  { id: "lic-market",  group: "Licensing", icon: "📄", name: "Licensing market",      desc: "Airlines, hotels and TV networks bid for your finished films — accept, decline, or let offers lapse.", render: deskLicMarket },
  { id: "lic-offices", group: "Licensing", icon: "🏢", name: "International offices", desc: "Permanent offices in London, Tokyo and Seoul — weekly income and faster regional reputation growth.", render: deskLicOffices }
];

/* ── actions (ui.js onAction will try licensingAction) ────────── */
function licCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function licensingAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("lic-") !== 0) return false;
  licEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var r = null;
  if (a === "lic-accept") r = licAccept(id);
  else if (a === "lic-decline") r = licDecline(id);
  else if (a === "lic-office") r = licBuildOffice(id);
  else return false;
  if (r && r.err) { toast(r.err, "bad"); return true; }
  licCommit();
  return true;
}
