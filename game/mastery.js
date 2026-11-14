/* Box Office War — rebuilt. Mastery module — all state under S.mast.
   Three long-game systems:
   1. Genre mastery — films that finished their theatrical run (status "done")
      build per-genre tiers: 5 done → Apprentice (+2 craft), 10 → Adept (+4
      craft, openings ×1.03), 20 → Master (+6 craft, ×1.06). The highest tier
      reached applies. Hooks (engine.js, LIVE): masteryCraftMod(genre) inside
      computeQuality, masteryOpenMult(genre) inside expectedOpening.
   2. Agency relationships — three external agencies (rep 0-100, start 20).
      Signing exclusivity with ONE costs $5M, gives that agency +15 rep and
      makes their tagged talent cost ×0.9 via agencyFeeMult(talent) (engine
      feeFor, LIVE). tickMastery tags untagged market talent (60% one of the
      three agencies, else Independent). A signed agency at rep ≥ 50 sends a
      free power ≥ 3 talent to the market 30%/week (first-look deal).
      Re-signing an agency you dropped before is allowed — each signing is
      +15 rep, so switching back and forth is the road to a first-look deal.
   3. Scouting trips — $3M, 4-week cooldown: one hidden newcomer joins the
      market. The report undersells them: the displayed skill is 15 points
      low, and t.realSkill = rolled skill + ri(5,20). When cast on a project,
      tickMastery reveals them: skill = realSkill, hidden = false, news.
   Also defined: tickMastery() (weekly), masteryAction(a, elx), MASTERY_DESKS
   (mast-genre / mast-agency, group "Mastery") and forecastAdjust_mastery() → 0
   (every cost is upfront; the global forecastAdjust aggregator lives in ui.js,
   suffix uniform with tech/library/finance/media).
   NOTE for integrator: engine.js advanceWeek does not call tickMastery yet
   (its tick list ends at tickBizdeal) and collectDesks()/onAction do not
   reference MASTERY_DESKS/masteryAction yet. The three engine hooks above ARE
   live. tickMastery is safe to call any number of times per week: tagging only
   touches untagged talent, reveals only fire once (hidden flag), the cooldown
   decrements once per call — a late wiring changes nothing. The vm test calls
   tickMastery after each advanceWeek.
*/
"use strict";

/* ── module data ─────────────────────────────────────────────── */
var MAST_AGENCIES = [
  { id: "meridian",  n: "Meridian Talent", em: "🌟" },
  { id: "apex",      n: "Apex Artists",     em: "⚡" },
  { id: "northstar", n: "Northstar Rep",    em: "🧭" }
];
var MAST_TIERS = [
  { at: 5,  n: "Apprentice", craft: 2, open: 1 },
  { at: 10, n: "Adept",      craft: 4, open: 1.03 },
  { at: 20, n: "Master",     craft: 6, open: 1.06 }
];
var MAST_SIGN_COST = 5;
var MAST_SCOUT_COST = 3;
var MAST_SCOUT_CD = 4;
var MAST_INDEP = "indep";

/* ── state (lazy ensure — old saves have no S.mast) ──────────── */
function mastEnsure() {
  if (!S.mast) S.mast = { agencies: [], signedId: null, scoutCd: 0 };
  if (!S.mast.agencies) S.mast.agencies = [];
  var i, j, found;
  for (i = 0; i < MAST_AGENCIES.length; i++) {
    found = null;
    for (j = 0; j < S.mast.agencies.length; j++) if (S.mast.agencies[j].id === MAST_AGENCIES[i].id) found = S.mast.agencies[j];
    if (!found) S.mast.agencies.push({ id: MAST_AGENCIES[i].id, rep: 20 });
    else if (!isFinite(found.rep)) found.rep = 20;
  }
  if (typeof S.mast.signedId !== "string") S.mast.signedId = null;
  if (typeof S.mast.scoutCd !== "number" || !isFinite(S.mast.scoutCd)) S.mast.scoutCd = 0;
}
function mastStateAgency(id) {
  var i;
  for (i = 0; i < S.mast.agencies.length; i++) if (S.mast.agencies[i].id === id) return S.mast.agencies[i];
  return null;
}
function mastAgMeta(id) {
  var i;
  for (i = 0; i < MAST_AGENCIES.length; i++) if (MAST_AGENCIES[i].id === id) return MAST_AGENCIES[i];
  return null;
}
function mastAgName(id) { var m = mastAgMeta(id); return m ? m.n : id; }

/* ── system 1: genre mastery ─────────────────────────────────── */
function mastGenreCount(genreId) {
  var n = 0, i;
  for (i = 0; i < S.films.length; i++) if (S.films[i].genre === genreId && S.films[i].status === "done") n++;
  return n;
}
function mastGenreTier(genreId) {
  var best = null, i;
  for (i = 0; i < MAST_TIERS.length; i++) if (mastGenreCount(genreId) >= MAST_TIERS[i].at) best = MAST_TIERS[i];
  return best;
}
function mastNextTier(genreId) {
  var i;
  for (i = 0; i < MAST_TIERS.length; i++) if (mastGenreCount(genreId) < MAST_TIERS[i].at) return MAST_TIERS[i];
  return null;
}
function masteryCraftMod(genre) {
  if (!S || !genre) return 0;
  var t = mastGenreTier(genre);
  return t ? t.craft : 0;
}
function masteryOpenMult(genre) {
  if (!S || !genre) return 1;
  var t = mastGenreTier(genre);
  return t ? t.open : 1;
}

/* ── system 2: agency relationships ──────────────────────────── */
function agencyFeeMult(t) {
  if (!S || !S.mast || !S.mast.signedId || !t) return 1;
  return t.agency === S.mast.signedId ? 0.9 : 1;
}
function mastSign(id) {
  mastEnsure();
  var ag = mastStateAgency(id);
  if (!ag) return { err: "Pick an agency to sign with." };
  var name = mastAgName(ag.id);
  if (S.mast.signedId === ag.id) return { err: name + " is already your exclusive agency." };
  if (S.studio.cash < MAST_SIGN_COST) return { err: "Need " + fm(MAST_SIGN_COST) + " to sign with " + name + "." };
  spend(MAST_SIGN_COST, "Agency signing · " + name);
  S.mast.signedId = ag.id;
  ag.rep = clamp(ag.rep + 15, 0, 100);
  log("✍️ Exclusive deal signed with " + name + " — their talent costs ×0.9 through you now. Their rep is " + Math.round(ag.rep) + "/100.", "good", "🤝");
  toast("Signed with " + name + " — their talent costs ×0.9.", "good");
  return { ok: true };
}
function mastTagMarket() {
  var i;
  for (i = 0; i < S.market.length; i++) {
    if (!S.market[i].agency) S.market[i].agency = chance(0.6) ? pick(MAST_AGENCIES).id : MAST_INDEP;
  }
}
function mastFirstLook() {
  var ag = S.mast.signedId ? mastStateAgency(S.mast.signedId) : null;
  if (!ag || ag.rep < 50 || !chance(0.30)) return;
  var kind = chance(0.7) ? "actor" : "dir";
  var t = genTalent(kind);
  while (t.power < 3) t = genTalent(kind);
  t.agency = ag.id;
  S.market.push(t);
  log("📧 First-look deal: " + ag.n + " sent over " + t.n + " (" + (kind === "actor" ? "actor" : "director") + ", power " + t.power + ") on a first-look deal — free to sign, no strings.", "good", "📧");
}

/* ── system 3: scouting trips ────────────────────────────────── */
function mastScout() {
  mastEnsure();
  if (S.mast.scoutCd > 0) return { err: "Scouts are still out — back in " + S.mast.scoutCd + " week(s)." };
  if (S.studio.cash < MAST_SCOUT_COST) return { err: "Need " + fm(MAST_SCOUT_COST) + " to send scouts." };
  spend(MAST_SCOUT_COST, "Scouting trip");
  var kind = chance(0.7) ? "actor" : "dir";
  var t = genTalent(kind);
  t.hidden = true;
  t.realSkill = clamp(t.skill + ri(5, 20), 5, 97);
  t.skill = clamp(t.skill - 15, 5, 97);
  S.market.push(t);
  S.mast.scoutCd = MAST_SCOUT_CD;
  log("🔍 Scouts found " + t.n + " — " + (kind === "actor" ? "an actor" : "a director") + " nobody knows (reported skill " + Math.round(t.skill) + "). Insiders whisper the report undersells them.", "", "🔍");
  toast("🔍 Scouts found an unknown talent.", "");
  return { ok: true, talent: t };
}
function mastReveal(t) {
  t.hidden = false;
  if (isFinite(t.realSkill)) t.skill = t.realSkill;
  log("🌟 " + t.n + " revealed on set — true skill " + Math.round(t.skill) + ", far beyond the scouting report.", "gold", "🌟");
  toast("🌟 " + t.n + " is a hidden gem revealed!", "gold");
}
function mastRevealHidden() {
  var i, p, t;
  for (i = 0; i < S.projects.length; i++) {
    p = S.projects[i];
    t = findTalent(p.actId);
    if (t && t.hidden && isFinite(t.realSkill)) mastReveal(t);
    t = findTalent(p.dirId);
    if (t && t.hidden && isFinite(t.realSkill)) mastReveal(t);
  }
}

/* ── weekly tick ─────────────────────────────────────────────── */
function tickMastery() {
  if (!S || S.over) return;
  mastEnsure();
  mastTagMarket();
  mastFirstLook();
  mastRevealHidden();
  if (S.mast.scoutCd > 0) S.mast.scoutCd--;
}

/* ── commit + action delegation (ui will call masteryAction) ─── */
function mastCommit() {
  saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function mastHandle(r) {
  if (r && r.err) { toast(r.err, "bad"); return; }
  mastCommit();
}
function masteryAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("mast-") !== 0) return false;
  mastEnsure();
  var id = (elx && elx.getAttribute) ? elx.getAttribute("data-id") : null;
  if (a === "mast-sign") { mastHandle(mastSign(id)); return true; }
  if (a === "mast-scout") { mastHandle(mastScout()); return true; }
  return false;
}

/* ── cashflow forecast: all costs upfront, nothing weekly ────── */
function forecastAdjust_mastery() { return 0; }

/* ── desk 1: genre mastery ───────────────────────────────────── */
function mastGenreDesk() {
  mastEnsure();
  var i, g, c, tier, next, total = 0, html = "<div>";
  for (i = 0; i < S.films.length; i++) if (S.films[i].status === "done") total++;
  html += '<div class="card">'
    + statrow("Done films across all genres", String(total))
    + statrow("Genre craft bonus", "+2 · +4 · +6 at 5 / 10 / 20 done films", "up")
    + statrow("Genre opening boost", "Adept ×1.03 · Master ×1.06", "up")
    + "</div>";
  html += '<div class="sechead"><h2>The ladder</h2></div><div class="card">';
  for (i = 0; i < GENRES.length; i++) {
    g = GENRES[i];
    c = mastGenreCount(g.id);
    tier = mastGenreTier(g.id);
    next = mastNextTier(g.id);
    var lvTxt = tier ? tier.n : "—";
    var lvCls = tier ? (tier.n === "Master" ? "gold" : "green") : "";
    var sub = next ? c + " done · " + (next.at - c) + " more to " + next.n : c + " done · top tier reached";
    html += '<div class="statrow"><span class="k">' + g.em + " " + esc(g.name)
      + '<br><small style="color:var(--faint)">' + sub
      + (tier ? " · +" + tier.craft + " craft" + (tier.open > 1 ? ", openings ×" + tier.open.toFixed(2) : "") : "")
      + "</small></span>"
      + '<span class="v num">' + tag(lvTxt, lvCls) + "</span></div>";
    html += '<div class="bar' + (tier && tier.n === "Master" ? " green" : "") + '"><i style="width:' + clamp(Math.round(c / 20 * 100), 3, 100) + '%"></i></div>';
  }
  html += "</div>";
  html += '<div class="card"><div class="empty" style="padding:8px 0 0">🎯 Every film that finishes its theatrical run deepens one genre. Mastery is permanent — craft and openings apply to every new film of that genre.</div></div>';
  return html + "</div>";
}

/* ── desk 2: agency relations + scouting trips ───────────────── */
function mastAgencyDesk() {
  mastEnsure();
  var i, ag, mine, meta, signed = S.mast.signedId ? mastStateAgency(S.mast.signedId) : null;
  var html = "<div>";
  html += '<div class="card">'
    + statrow("Your exclusive agency", signed ? esc(mastAgName(signed.id)) + " " + tag("Exclusive", "gold") : "—")
    + statrow("Their talent fee", S.mast.signedId ? "×0.9 on every talent they represent" : "—", S.mast.signedId ? "up" : "")
    + statrow("First-look deals", signed ? (signed.rep >= 50 ? "Active · 30%/wk one free talent joins the market" : "Unlocks at rep 50 (now " + Math.round(signed.rep) + ")") : "Sign an agency to build a relationship")
    + "</div>";
  html += '<div class="sechead"><h2>Agencies</h2></div><div class="card">';
  for (i = 0; i < S.mast.agencies.length; i++) {
    ag = S.mast.agencies[i];
    meta = mastAgMeta(ag.id);
    mine = S.mast.signedId === ag.id;
    html += '<div class="statrow"><span class="k">' + (meta ? meta.em : "🤝") + " " + esc(mastAgName(ag.id))
      + '<br><small style="color:var(--faint)">rep ' + Math.round(ag.rep) + "/100 · " + (mine ? "your agency — their talent costs ×0.9" : "sign for ×0.9 on their talent") + "</small></span>"
      + '<span class="v num">' + (mine ? tag("Yours", "gold") : tag("Rep " + Math.round(ag.rep), "")) + "</span></div>";
    html += '<div class="bar' + (mine ? " green" : "") + '"><i style="width:' + clamp(Math.round(ag.rep), 3, 100) + '%"></i></div>';
    if (!mine) {
      html += '<div class="statrow"><span class="k">Sign exclusive · ' + fm(MAST_SIGN_COST)
        + '<br><small style="color:var(--faint)">their rep +15 · cash after ' + fm(S.studio.cash - MAST_SIGN_COST) + "</small></span>"
        + '<button class="btn sm" data-action="mast-sign" data-id="' + ag.id + '"' + (S.studio.cash < MAST_SIGN_COST ? " disabled" : "") + ">Sign</button></div>";
    }
  }
  html += "</div>";
  html += '<div class="sechead"><h2>Scouting trips</h2></div><div class="card">';
  html += '<div class="statrow"><span class="k">Send scouts · ' + fm(MAST_SCOUT_COST)
    + '<br><small style="color:var(--faint)">one unknown talent joins the market — the report undersells them · cooldown ' + MAST_SCOUT_CD + " weeks"
    + (S.mast.scoutCd > 0 ? " · back in " + S.mast.scoutCd + " wk(s)" : "") + "</small></span>"
    + '<button class="btn primary sm" data-action="mast-scout"' + (S.mast.scoutCd > 0 || S.studio.cash < MAST_SCOUT_COST ? " disabled" : "") + ">"
    + (S.mast.scoutCd > 0 ? "Out (" + S.mast.scoutCd + "w)" : "Send · " + fm(MAST_SCOUT_COST)) + "</button></div>";
  html += "</div>";
  html += '<div class="card"><div class="empty" style="padding:8px 0 0">🤝 Exclusivity is one agency at a time — switch anytime for another $' + MAST_SIGN_COST + "M. Each signing builds rep; rep 50 starts the first-look pipeline.</div></div>";
  return html + "</div>";
}

var MASTERY_DESKS = [
  { id: "mast-genre", group: "Mastery", icon: "🎯", name: "Genre mastery",
    desc: "The long game per genre — done films build tiers that add craft and open films bigger, forever.",
    render: mastGenreDesk },
  { id: "mast-agency", group: "Mastery", icon: "🤝", name: "Agency relations",
    desc: "Three agencies, one exclusive deal — cheaper talent, first-look deliveries, and scouting trips for hidden gems.",
    render: mastAgencyDesk }
];
