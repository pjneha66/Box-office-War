/* Box Office War — rebuilt. Deep awards module (v46 module 8) — all state under S.awp.
   Extends the year-end ceremony that awards.js already runs: after
   extraAwardCategories() has handed out Best Actor / Director / Song, the engine calls
   awardsPlusCategories(yearFilms) with the year's real film records and this module
   awards the six craft and below-the-line categories:
     Best Cinematography · Best Production Design · Best Sound ·
     Best Editing · Best Original Score · Best Ensemble.
   The rebuild has no per-film craft identity (no DP, editor or composer on a film
   record), so every category is scored from data that does exist on the record —
   quality, criticAvg, aud, freshPct, genre, budget/cost, legs and the supporting
   cast — plus a genre-affinity table (a sci-fi/fantasy film leans Cinematography and
   Design, an action film leans Sound and Editing, a comedy leans Ensemble) and a
   small random term so the result is weighted, not deterministic and not a lottery.
   Rival films from S.rFilms compete in every category: their craft stats are derived
   deterministically from opening size, genre and a stable title hash, so they are
   stable between the nominees desk and the ceremony. Losing is the point.
   Winning pays a small cash bonus (earn(), ledger-labelled "Craft award · …") and a
   reputation gain; every statuette — yours or a rival's — is written to
   S.awp.history. awards.js owns S.aw, so this module never writes it; the history
   desk reads S.aw defensively and shows both shelves.
   Campaigns: the player can buy one per film per category ("awp-campaign"). A
   campaign adds craft points to that film in that category, costs cash up front and
   decays 12% per week in tickAwardsPlus(), expiring once it is spent.
   Wiring: engine calls tickAwardsPlus() inside advanceWeek() and
   awardsPlusCategories() from yearAwards(); ui.js bridges awardsplusAction() and
   collects AWARDSPLUS_DESKS. Nothing here wraps advanceWeek or onAction.
   Hook limitation and how it is handled: when any module defines awardNightBegin()
   (events2.js does), the engine's yearAwards() returns before it reaches
   awardsPlusCategories(), so the engine path alone would never award these
   categories in the shipped build. tickAwardsPlus() therefore also runs the ceremony
   for a season the engine skipped, in the first three weeks of the following year,
   guarded by S.awp.yearsAwarded so a season is never paid out twice. */
"use strict";

/* ── category table ───────────────────────────────────────────── */
/* w = the weights applied to the film's real numbers. cash/rep = the winner's
   payout. boost = craft points a bought campaign adds. jitter = ± random term. */
var AWP_CATS = [
  { id: "cinematography", name: "Best Cinematography", ico: "🎥", cost: 2.5, cash: 1.5, rep: 2, boost: 8, jitter: 5,
    w: { q: 0.34, cr: 0.26, aud: 0.08, fresh: 0.10, legs: 0.06, budget: 0.06 } },
  { id: "design", name: "Best Production Design", ico: "🏛️", cost: 2, cash: 1.5, rep: 2, boost: 8, jitter: 5,
    w: { q: 0.30, cr: 0.16, aud: 0.06, fresh: 0.06, legs: 0.04, budget: 0.14 } },
  { id: "sound", name: "Best Sound", ico: "🔊", cost: 2, cash: 1.2, rep: 1, boost: 7, jitter: 5,
    w: { q: 0.30, cr: 0.12, aud: 0.20, fresh: 0.08, legs: 0.04, budget: 0.08 } },
  { id: "editing", name: "Best Editing", ico: "✂️", cost: 2, cash: 1.2, rep: 1, boost: 7, jitter: 5,
    w: { q: 0.38, cr: 0.20, aud: 0.10, fresh: 0.08, legs: 0.10, budget: 0.02 } },
  { id: "score", name: "Best Original Score", ico: "🎼", cost: 2.5, cash: 1.5, rep: 2, boost: 8, jitter: 5,
    w: { q: 0.28, cr: 0.22, aud: 0.08, fresh: 0.10, legs: 0.10, budget: 0.02 } },
  { id: "ensemble", name: "Best Ensemble", ico: "🎭", cost: 3, cash: 2, rep: 3, boost: 9, jitter: 6,
    w: { q: 0.14, cr: 0.08, aud: 0.40, fresh: 0.05, legs: 0.05, budget: 0.03 } }
];

/* genre → craft points per category (roughly -2 … +9). A high-craft genre film
   (sci-fi, fantasy, animation) should take Cinematography/Design; comedy and drama
   casts should take Ensemble. */
var AWP_AFFINITY = {
  cinematography: { scifi: 8, fantasy: 7, animation: 6, action: 5, horror: 4, drama: 4, thriller: 3, musical: 3, crime: 2, docs: 2, romance: 0, comedy: -1 },
  design:         { fantasy: 9, scifi: 8, animation: 7, action: 5, musical: 5, horror: 3, drama: 2, crime: 1, thriller: 0, romance: 0, comedy: -1, docs: -2 },
  sound:          { action: 8, scifi: 7, horror: 6, animation: 5, musical: 5, thriller: 4, fantasy: 3, crime: 1, drama: 0, comedy: 0, romance: -1, docs: -2 },
  editing:        { thriller: 7, action: 6, crime: 5, comedy: 4, horror: 4, scifi: 3, animation: 3, drama: 2, fantasy: 2, musical: 1, docs: 1, romance: 0 },
  score:          { musical: 7, drama: 7, fantasy: 6, animation: 5, romance: 4, scifi: 4, horror: 3, crime: 2, thriller: 2, action: 1, docs: 1, comedy: 0 },
  ensemble:       { comedy: 10, drama: 8, crime: 6, romance: 5, animation: 4, musical: 4, fantasy: 0, thriller: 1, horror: -1, scifi: -4, action: -2, docs: -1 }
};

var AWP_RIVAL_CAP = 8;       /* rival films considered per ceremony */
var AWP_HISTORY_CAP = 400;
var AWP_DECAY = 0.88;        /* campaign strength kept each week */
var AWP_MIN_BOOST = 0.8;     /* campaign is spent below this */

/* ── state (lazy ensure — old saves have no S.awp) ────────────── */
function awpEnsure() {
  if (!S) return;
  if (!S.awp) S.awp = {};
  var A = S.awp;
  if (!A.history) A.history = [];
  if (!A.campaigns) A.campaigns = [];
  if (!awpNum(A.lastTick)) A.lastTick = 0;
  if (!awpNum(A.wins)) A.wins = 0;
  if (!awpNum(A.rivalWins)) A.rivalWins = 0;
  if (!awpNum(A.cashWon)) A.cashWon = 0;
  if (!awpNum(A.repWon)) A.repWon = 0;
  if (!awpNum(A.campaignsBought)) A.campaignsBought = 0;
  if (!awpNum(A.campaignSpend)) A.campaignSpend = 0;
  if (!A.yearsAwarded) A.yearsAwarded = {};
}

/* Which seasons already had a craft ceremony. awardsPlusCategories() marks the season
   it awards; tickAwardsPlus() uses the map to run the ceremony itself when the engine
   path was skipped (see the catch-up note on tickAwardsPlus). */
/* how many history rows already exist for a season */
function awpSeasonRows(y) {
  var n = 0, i;
  if (!S || !S.awp || !S.awp.history) return 0;
  for (i = 0; i < S.awp.history.length; i++) if (S.awp.history[i] && S.awp.history[i].y === y) n++;
  return n;
}
function awpMarkYear(y) {
  awpEnsure();
  if (awpNum(y) && y >= 1) S.awp.yearsAwarded[y] = true;
}

/* ── small helpers ────────────────────────────────────────────── */
function awpNum(x) { return typeof x === "number" && isFinite(x); }
function awpR2(x) { return Math.round(x * 100) / 100; }
function awpNumOr(x, d) { return awpNum(x) ? x : d; }
function awpCat(id) {
  var i;
  for (i = 0; i < AWP_CATS.length; i++) if (AWP_CATS[i].id === id) return AWP_CATS[i];
  return null;
}
function awpCatName(id) { var c = awpCat(id); return c ? c.name : id; }
function awpGenre(id) {
  var g = (typeof genreOf === "function") ? genreOf(id) : null;
  return g || { id: id, name: id, em: "🎬", mass: 1, legs: 0, intl: 0.5, open: 1, critic: 0, aud: 0 };
}
/* stable title hash → 0…1 so a rival film's synthetic craft numbers do not change
   between the nominees desk (rendered every week) and the ceremony itself */
function awpHash(s) {
  var t = String(s || ""), h = 0, i;
  for (i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 997;
  return (h % 100) / 100;
}
function awpFilmYear(f) {
  var wpy = (typeof WEEKS_PER_YEAR === "number" && WEEKS_PER_YEAR > 0) ? WEEKS_PER_YEAR : 52;
  if (!f || !awpNum(f.releaseWeek) || f.releaseWeek < 1) return S ? S.studio.year : 1;
  return Math.floor((f.releaseWeek - 1) / wpy) + 1;
}

/* ── craft stats for a film record ────────────────────────────── */
/* Player films carry quality/criticAvg/aud/freshPct/legs/budget and the supporting
   cast ids. Rivals carry only opening/legs/genre, so their craft numbers are
   synthesised from opening size (a bigger release implies more craft money) and the
   title hash. Both shapes come back identical to the scorer. */
function awpPlayerStats(f) {
  var g = awpGenre(f.genre);
  var q = clamp(awpNumOr(f.quality, 60), 5, 100);
  var ids = f.supIds || [], i, t, supN = 0, supPow = 0;
  for (i = 0; i < ids.length; i++) {
    supN++;
    t = (typeof findTalent === "function") ? findTalent(ids[i]) : null;
    supPow += t && awpNum(t.power) ? t.power : 2;
  }
  return {
    filmId: f.id, title: f.title, genre: f.genre, rival: false,
    studio: (S && S.studio && S.studio.name) ? S.studio.name : "Your studio",
    q: q,
    cr: clamp(awpNumOr(f.criticAvg, q + g.critic), 5, 100),
    aud: clamp(awpNumOr(f.aud, q + g.aud), 5, 100),
    fresh: clamp(awpNumOr(f.freshPct, 60), 0, 100),
    legs: clamp(awpNumOr(f.legs, 2.2), 1.2, 5),
    budget: Math.max(1, awpNumOr(f.budget, awpNumOr(f.cost, 20))),
    supN: supN, supPow: supPow
  };
}
function awpRivalStats(rf) {
  var g = awpGenre(rf.genre);
  var open = Math.max(0.5, awpNumOr(rf.opening, 10));
  var h = awpHash(rf.title);
  var base = 47 + Math.sqrt(open) * 2.5 + g.critic;
  var q = clamp(base, 42, 91);
  return {
    filmId: rf.id || null, title: rf.title, genre: rf.genre, rival: true,
    studio: rf.rival || "A rival studio",
    q: q,
    cr: clamp(q + g.critic * 0.5 + h * 4, 20, 98),
    aud: clamp(q + g.aud + h * 4, 20, 99),
    fresh: clamp(q - 4 + h * 6, 10, 100),
    legs: clamp(awpNumOr(rf.legs, 2.2), 1.2, 5),
    budget: 20 + open,
    supN: 0, supPow: 0
  };
}

/* Rival films that belong to the season being awarded. Rival records carry no
   releaseWeek, so their release week is reconstructed from weeksOut. */
function awpRivalCandidates(year) {
  var out = [], i, rf, wpy, rel, yr, want = awpNum(year) ? year : S.studio.year;
  if (!S || !S.rFilms) return out;
  wpy = (typeof WEEKS_PER_YEAR === "number" && WEEKS_PER_YEAR > 0) ? WEEKS_PER_YEAR : 52;
  for (i = 0; i < S.rFilms.length && out.length < AWP_RIVAL_CAP; i++) {
    rf = S.rFilms[i];
    if (!rf || !rf.title) continue;
    rel = S.studio.week - Math.max(0, awpNumOr(rf.weeksOut, 0));
    yr = Math.floor((Math.max(1, rel) - 1) / wpy) + 1;
    if (yr !== want) continue;
    out.push(awpRivalStats(rf));
  }
  return out;
}

/* ── scoring ──────────────────────────────────────────────────── */
function awpScoreParts(cat, st) {
  var row = AWP_AFFINITY[cat.id];
  var aff = (row && awpNum(row[st.genre])) ? row[st.genre] : 0;
  var w = cat.w;
  /* budget enters as a compressible term (a $200M tentpole is not 10× the craft of a
     $20M indie), capped so money buys an edge, not the trophy */
  var bud = Math.min(Math.sqrt(Math.max(1, st.budget)) * 6, 60);
  var s = st.q * w.q + st.cr * w.cr + st.aud * w.aud + st.fresh * w.fresh
        + st.legs * w.legs + bud * w.budget + aff;
  if (cat.id === "ensemble") {
    s += Math.min(st.supN, 3) * 1.6 + Math.min(st.supPow, 12) * 0.5;
  }
  return s;
}
/* campaign boost for one film/category pair (0 when none is running) */
function awpCampaign(filmId, catId) {
  awpEnsure();
  var i, c;
  for (i = 0; i < S.awp.campaigns.length; i++) {
    c = S.awp.campaigns[i];
    if (c.filmId === filmId && c.cat === catId) return c;
  }
  return null;
}
function awpCampaignBoost(filmId, catId) {
  var c = awpCampaign(filmId, catId);
  return c ? Math.max(0, awpNumOr(c.boost, 0)) : 0;
}
/* jitter adds the "not a foregone conclusion" term; the nominees/odds display calls
   the scorer without it so the number shown is stable. */
function awpScore(cat, st, boost, withJitter) {
  var s = awpScoreParts(cat, st) + (awpNum(boost) ? boost : 0);
  if (withJitter) s += rf(-cat.jitter, cat.jitter);
  return s;
}

/* ── resolution ───────────────────────────────────────────────── */
function awpResolveCat(cat, yearFilms, year) {
  var best = null, i, sc, st;
  for (i = 0; i < yearFilms.length; i++) {
    if (!yearFilms[i] || !yearFilms[i].title) continue;
    st = awpPlayerStats(yearFilms[i]);
    sc = awpScore(cat, st, awpCampaignBoost(st.filmId, cat.id), true);
    if (!best || sc > best.score) best = { st: st, score: sc, mine: true };
  }
  var rivals = awpRivalCandidates(year);
  for (i = 0; i < rivals.length; i++) {
    sc = awpScore(cat, rivals[i], 0, true);
    if (!best || sc > best.score) best = { st: rivals[i], score: sc, mine: false };
  }
  return best;
}

/* ── the ceremony (engine yearAwards calls this after extraAwardCategories) ── */
function awardsPlusCategories(yearFilms) {
  if (!S) return [];
  awpEnsure();
  return awpCeremony(yearFilms, S.studio.year);
}

/* The ceremony proper. The season is passed separately so the catch-up path below can
   award a season that ended before this module was ticked. */
function awpCeremony(yearFilms, year) {
  var films = [], i, cat, w, winner, winners = [];
  var wins = 0, rivalWins = 0, cash = 0, rep = 0, mineNames = [], rivalLine = null;

  awpEnsure();
  /* Idempotency: a season is paid exactly once. Both the engine hook and the
     tick catch-up can reach this function, and the engine may be re-entered
     (a reload that replays year-end, a resumed save at week 1). Without this
     check a season pays its craft bonuses again on every replay.
     The history rows are the authority, not just the year flag: a save that was
     migrated, or a reset that clears S.awp.history, must still be able to run a
     season rather than be permanently locked out by a stale flag. */
  if (awpNum(year) && year >= 1) {
    if (S.awp.yearsAwarded && S.awp.yearsAwarded[year] && awpSeasonRows(year) > 0) return winners;
  }

  if (yearFilms && yearFilms.length) {
    for (i = 0; i < yearFilms.length; i++) {
      if (yearFilms[i] && yearFilms[i].title) films.push(yearFilms[i]);
    }
  }
  awpMarkYear(year);
  if (!films.length && !awpRivalCandidates(year).length) return winners;

  for (i = 0; i < AWP_CATS.length; i++) {
    cat = AWP_CATS[i];
    w = awpResolveCat(cat, films, year);
    if (!w) continue;
    winner = {
      cat: cat.name, catId: cat.id, film: w.st.title, studio: w.st.studio,
      mine: !!w.mine, score: Math.round(w.score * 10) / 10
    };
    winners.push(winner);
    S.awp.history.push({
      y: year, w: S.studio.week, cat: cat.name, catId: cat.id,
      film: w.st.title, studio: w.st.studio, mine: !!w.mine,
      bonus: w.mine ? cat.cash : 0, rep: w.mine ? cat.rep : 0
    });
    if (w.mine) {
      earn(cat.cash, "Craft award · " + cat.name);
      S.studio.rep = clamp(S.studio.rep + cat.rep, 0, 100);
      S.awp.wins++;
      wins++;
      cash = awpR2(cash + cat.cash);
      rep += cat.rep;
      mineNames.push(cat.name);
    } else {
      S.awp.rivalWins++;
      rivalWins++;
      if (!rivalLine) rivalLine = w.st.title + " (" + w.st.studio + ", " + cat.name + ")";
    }
  }
  if (S.awp.history.length > AWP_HISTORY_CAP) {
    S.awp.history.splice(0, S.awp.history.length - AWP_HISTORY_CAP);
  }
  S.awp.cashWon = awpR2(S.awp.cashWon + cash);
  S.awp.repWon = Math.round(S.awp.repWon + rep);

  /* campaigns for that year's films are spent by the ceremony */
  awpConsumeCampaigns(films);

  if (wins > 0) {
    log("🏆 Craft awards, Year " + year + ": " + wins + "/6 statuettes to your studio ("
      + mineNames.join(", ") + ") — " + fm(cash) + " and reputation +" + rep + ".",
      "gold", "🏆");
    toast("🏆 " + wins + " craft awards — " + fm(cash) + " banked.", "gold");
  } else if (rivalWins > 0) {
    log("🏆 Craft awards, Year " + year + ": rivals take every statuette — "
      + rivalLine + ".", "", "🏆");
  }
  return winners;
}

function awpConsumeCampaigns(films) {
  var ids = {}, i, keep = [];
  for (i = 0; i < films.length; i++) if (films[i] && films[i].id) ids[films[i].id] = true;
  for (i = 0; i < S.awp.campaigns.length; i++) {
    if (!ids[S.awp.campaigns[i].filmId]) keep.push(S.awp.campaigns[i]);
  }
  S.awp.campaigns = keep;
}

/* ── rival nominees for display (stable — no jitter) ──────────── */
function awardsPlusNominees() {
  if (!S) return [];
  awpEnsure();
  var out = [], rivals = awpRivalCandidates(), i, j, cat, best, sc;
  for (i = 0; i < AWP_CATS.length; i++) {
    cat = AWP_CATS[i];
    best = null;
    for (j = 0; j < rivals.length; j++) {
      sc = awpScoreParts(cat, rivals[j]);
      if (!best || sc > best.sc) best = { sc: sc, st: rivals[j] };
    }
    if (best) out.push({ cat: cat.name, title: best.st.title, studio: best.st.studio });
  }
  return out;
}

/* ── odds (used by the campaign desk, and by the test) ────────── */
/* Softmax over the expected (jitter-free) scores of everyone in the category. A
   bought campaign raises this number monotonically, which is the point of the desk. */
function awpOdds(filmId, catId) {
  if (!S) return 0;
  awpEnsure();
  var cat = awpCat(catId), f = (typeof findFilm === "function") ? findFilm(filmId) : null;
  if (!cat || !f) return 0;
  var myScore = awpScore(cat, awpPlayerStats(f), awpCampaignBoost(filmId, catId), false);
  var others = [], i, list = awpRivalCandidates(), temp = 8;
  for (i = 0; i < S.films.length; i++) {
    if (!S.films[i] || S.films[i].id === filmId) continue;
    if (awpFilmYear(S.films[i]) !== S.studio.year) continue;
    others.push(awpScore(cat, awpPlayerStats(S.films[i]), awpCampaignBoost(S.films[i].id, cat.id), false));
  }
  for (i = 0; i < list.length; i++) others.push(awpScore(cat, list[i], 0, false));
  if (!others.length) return 0.5;
  var maxS = myScore;
  for (i = 0; i < others.length; i++) if (others[i] > maxS) maxS = others[i];
  var num = Math.exp((myScore - maxS) / temp), den = num;
  for (i = 0; i < others.length; i++) den += Math.exp((others[i] - maxS) / temp);
  if (!isFinite(num) || !isFinite(den) || den <= 0) return 0.05;
  return clamp(num / den, 0.01, 0.97);
}

/* ── campaign purchase ────────────────────────────────────────── */
function awpBuyCampaign(filmId, catId) {
  awpEnsure();
  var cat = awpCat(catId), f = (typeof findFilm === "function") ? findFilm(filmId) : null;
  if (!cat) return { err: "Unknown award category." };
  if (!f) return { err: "That film is not on the awards shelf." };
  if (awpCampaign(filmId, cat.id)) return { err: "A campaign is already running for that category." };
  if (S.awp.campaigns.length >= 12) return { err: "Too many campaigns running — finish one first." };
  var cost = cat.cost;
  if (!(S.studio.cash >= cost)) return { err: "Need " + fm(cost) + " for the " + cat.name + " campaign." };
  spend(cost, "Awards campaign · " + cat.name + " · " + f.title);
  S.awp.campaigns.push({
    id: "awp" + (S.seq++), filmId: filmId, title: f.title, cat: cat.id,
    boost: cat.boost, weeks: 0, start: S.studio.week, spent: cost
  });
  S.awp.campaignsBought++;
  S.awp.campaignSpend = awpR2(S.awp.campaignSpend + cost);
  log("🏆 Campaign opened: “" + f.title + "” for " + cat.name + " — " + fm(cost) + " of FYC spend.", "", "🏆");
  toast("Campaign running: " + cat.name + " · " + f.title + ".", "good");
  return { ok: true, cost: cost, odds: awpOdds(filmId, cat.id) };
}

/* ── weekly tick (campaign decay + season catch-up) ───────────── */
/* The engine calls awardsPlusCategories() from yearAwards() — but only when no other
   module defines awardNightBegin(): events2.js does, and its hook returns before the
   craft categories run. So the tick also awards a season the engine skipped: if the
   studio is in the first weeks of a year that has no ceremony on record and the year
   that just ended has released films, run the ceremony for that season ourselves.
   awpMarkYear() keeps this from ever firing twice for one season. */
function tickAwardsPlus() {
  if (!S || S.over) return;
  awpEnsure();
  if (S.awp.lastTick === S.studio.week) return; /* double-tick guard */
  S.awp.lastTick = S.studio.week;
  var i, c, woy = (typeof woyOf === "function") ? woyOf(S.studio.week) : 1;
  var cur = S.studio.year;

  for (i = S.awp.campaigns.length - 1; i >= 0; i--) {
    c = S.awp.campaigns[i];
    c.weeks = (awpNum(c.weeks) ? c.weeks : 0) + 1;
    c.boost = awpR2(awpNumOr(c.boost, 0) * AWP_DECAY);
    if (c.boost < AWP_MIN_BOOST) S.awp.campaigns.splice(i, 1);
  }

  if (woy <= 3) {
    var prev = cur - 1, films = [], f;
    if (prev >= 1 && !S.awp.yearsAwarded[prev]) {
      for (i = 0; i < S.films.length; i++) {
        f = S.films[i];
        if (f && f.title && awpFilmYear(f) === prev) films.push(f);
      }
      if (films.length) awpCeremony(films, prev);
      else awpMarkYear(prev);
    }
  }
}

/* ── commit + action delegation (ui calls awardsplusAction) ───── */
function awpCommit() {
  if (typeof saveGame === "function") saveGame();
  if (typeof render === "function") render();
  if (typeof drainFlash === "function") drainFlash();
}
function awardsplusAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("awp-") !== 0) return false;
  awpEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var r;
  switch (a) {
    case "awp-campaign": r = awpBuyCampaign(id, key); break;
    default: return false;
  }
  if (r && r.err) toast(r.err, "bad");
  else awpCommit();
  return true;
}

/* ── desks ────────────────────────────────────────────────────── */
function awpDeskHistory() {
  awpEnsure();
  var H = S.awp.history, html = "", i, h, shown = 0, years = {}, yc = 0, k;
  for (i = 0; i < H.length; i++) if (H[i] && !years[H[i].y]) { years[H[i].y] = true; yc++; }

  html += '<div class="card">'
    + statrow("Craft trophies", String(S.awp.wins))
    + statrow("Rival statuettes logged", String(S.awp.rivalWins))
    + statrow("Award cash banked", fm(S.awp.cashWon), S.awp.cashWon > 0 ? "up" : "")
    + statrow("Reputation from craft", "+" + Math.round(S.awp.repWon))
    + statrow("Awards nights on record", String(yc))
    + statrow("Campaigns running", String(S.awp.campaigns.length))
    + "</div>";

  html += '<div class="sechead"><h2>Craft &amp; below the line</h2></div>';
  if (!H.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎥</span>No craft statuettes yet. The six below-the-line categories are decided at the year-end ceremony, week 52.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = H.length - 1; i >= 0 && shown < 30; i--, shown++) {
      h = H[i];
      if (!h) continue;
      html += '<div class="statrow"><span class="k">Year ' + esc(String(h.y)) + " · " + esc(String(h.cat))
        + '</span><span class="v num">“' + esc(String(h.film)) + "” · " + esc(String(h.studio))
        + (h.mine ? ' <span class="tag gold">Yours</span>' : "") + "</span></div>";
    }
    html += "</div>";
  }

  /* awards.js owns S.aw — read it defensively and show the other shelf too */
  var AW = (S.aw && S.aw.history) ? S.aw.history : null;
  html += '<div class="sechead"><h2>Classic awards (Actor · Director · Song)</h2></div>';
  if (!AW || !AW.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏆</span>The classic shelf is empty — Best Actor, Best Director and Best Original Song are handed out first.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = AW.length - 1, k = 0; i >= 0 && k < 10; i--, k++) {
      h = AW[i];
      if (!h) continue;
      html += '<div class="statrow"><span class="k">Year ' + esc(String(h.y)) + " · " + esc(String(h.cat))
        + '</span><span class="v num">“' + esc(String(h.film)) + "”" + (h.who ? " · " + esc(String(h.who)) : "") + "</span></div>";
    }
    html += "</div>";
  }
  return html;
}

function awpDeskCampaign() {
  awpEnsure();
  var html = "", i, j, f, cat, odds, can, cost, list = [], running = 0, c;
  for (i = 0; i < S.awp.campaigns.length; i++) running += Math.max(0, awpNumOr(S.awp.campaigns[i].boost, 0));

  html += '<div class="card">'
    + statrow("Cash on hand", fm(S.studio.cash), S.studio.cash < 10 ? "down" : "up")
    + statrow("Campaigns bought", String(S.awp.campaignsBought))
    + statrow("FYC spend to date", fm(S.awp.campaignSpend))
    + statrow("Craft points in flight", String(Math.round(running)))
    + "</div>";
  html += '<div class="sechead"><h2>How it works</h2></div>';
  html += '<div class="card"><div class="meta">'
    + tag("One campaign per film · category", "blue")
    + tag("Decays 12% a week", "")
    + tag("Decided week 52", "gold")
    + '</div><div class="statrow"><span class="k">A campaign raises that film\'s craft score in one category. Campaigns fade weekly and are spent at the ceremony.</span></div></div>';

  html += '<div class="sechead"><h2>Active campaigns</h2></div>';
  if (!S.awp.campaigns.length) {
    html += '<div class="card"><div class="empty"><span class="em">🏆</span>No campaign running. Pick a film and a category below.</div></div>';
  } else {
    html += '<div class="card">';
    for (i = S.awp.campaigns.length - 1; i >= 0; i--) {
      c = S.awp.campaigns[i];
      html += '<div class="statrow"><span class="k">' + esc(String(c.title)) + " · " + esc(awpCatName(c.cat))
        + '</span><span class="v num">+' + Math.round(awpNumOr(c.boost, 0)) + " craft · "
        + Math.max(0, (awpNum(c.weeks) ? c.weeks : 0)) + " wk</span></div>";
    }
    html += "</div>";
  }

  /* films on the shelf this year, newest first */
  for (i = 0; i < S.films.length; i++) {
    f = S.films[i];
    if (!f || !f.title) continue;
    if (awpFilmYear(f) !== S.studio.year) continue;
    list.push(f);
  }
  if (!list.length) {
    for (i = 0; i < S.films.length && list.length < 3; i++) if (S.films[i] && S.films[i].title) list.push(S.films[i]);
  }
  html += '<div class="sechead"><h2>Films eligible for Year ' + S.studio.year + "</h2></div>";
  if (!list.length) {
    html += '<div class="card"><div class="empty"><span class="em">🎬</span>No release on the shelf this year. A campaign only pays off if the film is in the year-end field.</div></div>';
    return html;
  }
  for (i = 0; i < list.length && i < 3; i++) {
    f = list[i];
    html += '<div class="card film"><div class="head"><div class="title">' + esc(String(f.title)) + "</div>"
      + tag("Quality " + Math.round(awpNumOr(f.quality, 60)), "blue") + "</div>";
    html += '<div class="meta">'
      + tag(awpGenre(f.genre).em + " " + awpGenre(f.genre).name, "")
      + tag("Critics " + Math.round(awpNumOr(f.criticAvg, 60)) + "%", awpNumOr(f.criticAvg, 60) >= 70 ? "green" : "")
      + tag("Audience " + Math.round(awpNumOr(f.aud, 60)), awpNumOr(f.aud, 60) >= 70 ? "green" : "")
      + "</div>";
    for (j = 0; j < AWP_CATS.length; j++) {
      cat = AWP_CATS[j];
      odds = awpOdds(f.id, cat.id);
      can = !awpCampaign(f.id, cat.id) && S.studio.cash >= cat.cost;
      html += '<div class="statrow"><span class="k">' + esc(cat.name) + " · odds "
        + Math.round(odds * 100) + "% · " + fm(cat.cost) + " · after " + fm(S.studio.cash - cat.cost) + "</span>"
        + (awpCampaign(f.id, cat.id)
          ? '<span class="v">' + tag("Running", "gold") + "</span>"
          : '<button class="btn sm" data-action="awp-campaign" data-id="' + esc(String(f.id))
            + '" data-key="' + cat.id + '" ' + (can ? "" : "disabled") + ">Back</button>")
        + "</div>";
    }
    html += "</div>";
  }
  return html;
}

var AWARDSPLUS_DESKS = [
  { id: "awp-history", group: "Awards", icon: "🎥", name: "Craft awards history",
    desc: "Every below-the-line statuette — cinematography, design, sound, editing, score, ensemble — years of player and rival winners, plus the classic awards shelf.",
    render: awpDeskHistory },
  { id: "awp-campaign", group: "Awards", icon: "🏆", name: "Craft campaigns",
    desc: "Fund a per-film, per-category awards campaign: cash today, better odds at the week-52 ceremony, 12% decay a week.",
    render: awpDeskCampaign }
];

/* ── achievements (merged by meta.js allAchievements) ─────────── */
var AWARDSPLUS_ACHIEVEMENTS = [
  { id: "awp-first-trophy", tier: 1, name: "Below the line",
    desc: "Win your first craft award — cinematography, design, sound, editing, score or ensemble.",
    test: function (S) { return !!S.awp && awpNum(S.awp.wins) && S.awp.wins >= 1; } },
  { id: "awp-craft-sweep", tier: 3, name: "Craft sweep",
    desc: "Take three craft categories at a single awards night.",
    test: function (S) {
      if (!S.awp || !S.awp.history || !S.awp.history.length) return false;
      var counts = {}, i, h;
      for (i = 0; i < S.awp.history.length; i++) {
        h = S.awp.history[i];
        if (!h || !h.mine) continue;
        counts[h.y] = (counts[h.y] || 0) + 1;
        if (counts[h.y] >= 3) return true;
      }
      return false;
    } },
  { id: "awp-campaigner", tier: 2, name: "For your consideration",
    desc: "Fund three craft campaigns in one career.",
    test: function (S) { return !!S.awp && awpNum(S.awp.campaignsBought) && S.awp.campaignsBought >= 3; } },
  { id: "awp-rival-respect", tier: 2, name: "Rivals on the podium",
    desc: "Watch rivals take five craft statuettes from under you.",
    test: function (S) { return !!S.awp && awpNum(S.awp.rivalWins) && S.awp.rivalWins >= 5; } },
  { id: "awp-ten-trophies", tier: 3, name: "Craft house",
    desc: "Win ten craft awards across your career.",
    test: function (S) { return !!S.awp && awpNum(S.awp.wins) && S.awp.wins >= 10; } }
];
