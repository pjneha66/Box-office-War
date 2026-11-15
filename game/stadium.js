/* Box Office War — rebuilt. Sports megadome module (stadium).
   Arena tiers, corporate naming rights, live-sports broadcast packages.
   State under S.stad (lazy ensure). Hooks: none needed; own weekly income. */
"use strict";

var STAD_TIERS = [
  { id: "seats",    n: "Seating capacity", costs: [25, 45, 70], inc: [0.6, 1.1, 1.8] },
  { id: "skyboxes", n: "VIP luxury skyboxes", costs: [30, 55], inc: [0.8, 1.5] },
  { id: "concess",  n: "Concessions court", costs: [18, 32], inc: [0.4, 0.9] },
  { id: "jumbo",    n: "Broadcast jumbotrons", costs: [22, 40], inc: [0.5, 1.0] }
];
var STAD_NAMING = [
  { n: "Apex Energy", fee: 40, weekly: 1.2, wks: 52 },
  { n: "Horizon Tech", fee: 55, weekly: 1.6, wks: 52 },
  { n: "Zenith Capital", fee: 70, weekly: 2.0, wks: 52 }
];
var STAD_SPORTS = [
  { n: "Sunday Football", cost: 25, weekly: 1.4 },
  { n: "Championship Basketball", cost: 20, weekly: 1.1 },
  { n: "Grand Slam Tennis", cost: 16, weekly: 0.9 },
  { n: "Sunset Grand Prix", cost: 30, weekly: 1.7 },
  { n: "Apex Esports", cost: 12, weekly: 0.7 }
];

function stadEnsure() {
  if (!S.stad) S.stad = { built: false, tiers: {}, naming: null, sports: [] };
  var st = S.stad, i;
  for (i = 0; i < STAD_TIERS.length; i++) if (st.tiers[STAD_TIERS[i].id] == null) st.tiers[STAD_TIERS[i].id] = 0;
}
function stadBuild() {
  stadEnsure();
  if (S.stad.built || S.studio.cash < 70) return false;
  spend(70, "Build the megadome");
  S.stad.built = true;
  log("🏟️ The Apex Megadome opens on 40 acres of studio land.", "gold", "🏟️");
  toast("Sports megadome built.", "good");
  return true;
}
function stadTier(id) {
  stadEnsure();
  var t = null, i;
  for (i = 0; i < STAD_TIERS.length; i++) if (STAD_TIERS[i].id === id) t = STAD_TIERS[i];
  if (!t || !S.stad.built) return false;
  var lv = S.stad.tiers[id];
  if (lv >= t.costs.length) return false;
  if (S.studio.cash < t.costs[lv]) return false;
  spend(t.costs[lv], t.n + " upgrade");
  S.stad.tiers[id] = lv + 1;
  log("🏟️ " + t.n + " upgraded to tier " + (lv + 1) + ".", "good", "🏟️");
  return true;
}
function stadNaming(idx) {
  stadEnsure();
  var d = STAD_NAMING[idx];
  if (!d || !S.stad.built || S.stad.naming) return false;
  if (S.studio.cash < 0) return false;
  earn(d.fee, "Naming rights · " + d.n);
  S.stad.naming = { n: d.n, weekly: d.weekly, until: S.studio.week + d.wks };
  log("🏟️ " + d.n + " takes the naming rights — $" + d.fee + "M up front, " + fm(d.weekly) + "/week for a year.", "gold", "🏟️");
  return true;
}
function stadSport(idx) {
  stadEnsure();
  var sp = STAD_SPORTS[idx];
  if (!sp || !S.stad.built) return false;
  var i;
  for (i = 0; i < S.stad.sports.length; i++) if (S.stad.sports[i].n === sp.n && S.stad.sports[i].until > S.studio.week) return false;
  if (S.studio.cash < sp.cost) return false;
  spend(sp.cost, "Broadcast rights · " + sp.n);
  S.stad.sports.push({ n: sp.n, weekly: sp.weekly, until: S.studio.week + 26 });
  log("📺 Licensed " + sp.n + " for the dome — " + fm(sp.weekly) + "/week for 26 weeks.", "", "📺");
  if (S.tv && S.tv.streamer) { S.tv.streamer.subs += 0.4; log("Streaming subscribers tick up on the new sports package.", "good", "📈"); }
  return true;
}
function tickStad() {
  if (!S || S.over) return;
  stadEnsure();
  var st = S.stad, i, t, lv, inc = 0;
  if (!st.built) return;
  for (i = 0; i < STAD_TIERS.length; i++) {
    t = STAD_TIERS[i]; lv = st.tiers[t.id];
    if (lv > 0) inc += t.inc[lv - 1];
  }
  if (inc > 0) earn(Math.round(inc * 10) / 10, "Dome gate receipts");
  if (st.naming) {
    if (st.naming.until > S.studio.week) earn(st.naming.weekly, "Naming rights · " + st.naming.n);
    else { st.naming = null; log("The naming-rights deal expires. The roof goes back to plain steel.", "", "🏟️"); }
  }
  for (i = st.sports.length - 1; i >= 0; i--) {
    if (st.sports[i].until > S.studio.week) earn(st.sports[i].weekly, "Sports broadcast · " + st.sports[i].n);
    else st.sports.splice(i, 1);
  }
}
function stadDesk() {
  stadEnsure();
  var st = S.stad, html = "", i, t, lv;
  if (!st.built) {
    return '<div class="empty"><span class="em">🏟️</span>A 20,000-seat arena with skyboxes, concessions and jumbotrons — plus naming rights and live-sports licences.</div>'
      + '<div class="btnrow"><button class="btn primary grow" data-action="stad-build" ' + (S.studio.cash < 70 ? "disabled" : "") + ">Build the megadome · $70M</button></div>";
  }
  html += '<div class="card">' + statrow("Status", tag("Built", "green"));
  for (i = 0; i < STAD_TIERS.length; i++) {
    t = STAD_TIERS[i]; lv = st.tiers[t.id];
    html += '<div class="statrow"><span class="k">' + t.n + "<br><small style=\"color:var(--faint)\">tier " + lv + "/" + t.costs.length + "</small></span>";
    if (lv >= t.costs.length) html += tag("Maxed", "green") + "</div>";
    else html += '<button class="btn sm" data-action="stad-tier" data-key="' + t.id + '" ' + (S.studio.cash < t.costs[lv] ? "disabled" : "") + ">" + fm(t.costs[lv]) + "</button></div>";
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Naming rights</h2></div><div class="card">';
  if (st.naming) html += statrow(st.naming.n, fm(st.naming.weekly) + "/wk until W" + woyOf(st.naming.until));
  else STAD_NAMING.forEach(function (d, di) {
    html += statrow(d.n + " — " + fm(d.fee) + " now, " + fm(d.weekly) + "/wk × 52",
      '<button class="btn sm" data-action="stad-naming" data-idx="' + di + '">Sign</button>');
  });
  html += "</div>";
  html += '<div class="sechead"><h2>Live sports packages</h2></div><div class="card">';
  STAD_SPORTS.forEach(function (sp, si) {
    var active = false, k;
    for (k = 0; k < st.sports.length; k++) if (st.sports[k].n === sp.n && st.sports[k].until > S.studio.week) active = true;
    html += statrow(sp.n + " — " + fm(sp.cost) + ", " + fm(sp.weekly) + "/wk × 26",
      active ? tag("Licensed", "green") : '<button class="btn sm" data-action="stad-sport" data-idx="' + si + '" ' + (S.studio.cash < sp.cost ? "disabled" : "") + ">License</button>");
  });
  html += "</div>";
  return html;
}
var STAD_DESKS = [{ id: "stad-main", group: "Empire & Franchises", icon: "🏟️", name: "Sports megadome", desc: "Arena tiers, naming rights and live-sports broadcast packages.", render: stadDesk }];

function stadAction(a, elx) {
  if (!S || a.indexOf("stad-") !== 0) return false;
  if (a === "stad-build") { if (stadBuild()) { saveGame(); render(); } return true; }
  if (a === "stad-tier") { if (stadTier(elx.getAttribute("data-key"))) { saveGame(); render(); } return true; }
  if (a === "stad-naming") { if (stadNaming(+elx.getAttribute("data-idx"))) { saveGame(); render(); } return true; }
  if (a === "stad-sport") { if (stadSport(+elx.getAttribute("data-idx"))) { saveGame(); render(); } return true; }
  return false;
}
