/* Box Office War — rebuilt. Social Viral Network — all state under S.social.
   Systems: 4 platforms (InstaBuzz, VidTok, ChirpNet, StreamTube) with trend velocity +
   hashtag momentum · 6 viral campaign tiers that cost $ and boost film buzz · creator
   ambassadors retained for multi-week endorsement pacts amplifying film buzz via
   socialBuzzMult() (consumed by engine.js expectedOpening — free opening lift).
   Wiring: engine.js does NOT call tickSocial and ui.js does NOT bridge socialAction
   (no social hooks exist yet) — call tickSocial() after advanceWeek() and socialAction()
   directly; socialBuzzMult(p) is auto-applied to openings. Implement-around per contract. */
"use strict";

var SOCIAL_PLATFORMS = [
  { id: "instabuzz", name: "InstaBuzz",  icon: "📸", velocity: 1.00 },
  { id: "vidtok",    name: "VidTok",     icon: "🎵", velocity: 1.20 },
  { id: "chirpnet",  name: "ChirpNet",   icon: "🐦", velocity: 0.90 },
  { id: "streamtube",name: "StreamTube", icon: "▶️", velocity: 1.10 }
];

var SOCIAL_CAMPAIGNS = [
  { id: "grassroots", name: "Grassroots Leak", cost: 2,  buzz: 3,  weeks: 2 },
  { id: "meme",       name: "Meme Blitz",      cost: 5,  buzz: 6,  weeks: 3 },
  { id: "influencer", name: "Influencer Premiere", cost: 12, buzz: 10, weeks: 4 },
  { id: "global",     name: "Global Trend Takeover", cost: 25, buzz: 18, weeks: 5 },
  { id: "explosion",  name: "Viral Explosion", cost: 40, buzz: 30, weeks: 6 },
  { id: "mega",       name: "Mega Hype Wave", cost: 70, buzz: 50, weeks: 8 }
];

function socialEnsure() {
  if (!S.social) {
    S.social = { platforms: {}, campaigns: [], creators: [] };
    var i;
    for (i = 0; i < SOCIAL_PLATFORMS.length; i++) {
      var pl = SOCIAL_PLATFORMS[i];
      S.social.platforms[pl.id] = {
        name: pl.name, icon: pl.icon,
        velocity: pl.velocity, momentum: 0, trend: null
      };
    }
  }
  if (!S.social._pool) S.social._pool = [];
}

function socialGenCreator() {
  var pl = pick(SOCIAL_PLATFORMS), tier = ri(1, 5);
  return {
    id: "sc" + (S.seq++), name: genName(), platform: pl.id, tier: tier,
    fee: Math.round((0.5 + tier * 0.4) * 10) / 10,
    bonus: tier * 4, weeksLeft: 0, filmId: null, hired: false
  };
}

function socialPool() {
  while (S.social._pool.length < 3) S.social._pool.push(socialGenCreator());
  return S.social._pool;
}

function tickSocial() {
  if (!S || S.over) return;
  socialEnsure();
  if (S.social._lastTick === S.studio.week) return;
  S.social._lastTick = S.studio.week;

  var i, pl, keys = Object.keys(S.social.platforms);
  for (i = 0; i < keys.length; i++) {
    pl = S.social.platforms[keys[i]];
    pl.velocity = clamp(pl.velocity + rf(-0.15, 0.15), 0.5, 2);
    pl.momentum = clamp(pl.momentum * 0.8 + rf(-0.2, 0.2), -1, 1);
    if (chance(0.10)) pl.trend = pl.name + " trending";
    else if (pl.trend && chance(0.5)) pl.trend = null;
  }

  for (i = S.social.campaigns.length - 1; i >= 0; i--) {
    if (--S.social.campaigns[i].weeksLeft <= 0) S.social.campaigns.splice(i, 1);
  }

  for (i = S.social.creators.length - 1; i >= 0; i--) {
    var cr = S.social.creators[i];
    if (cr.weeksLeft > 0) {
      spend(cr.fee, "Creator · " + cr.name);
      if (--cr.weeksLeft <= 0) {
        var f = findFilm(cr.filmId) || findProject(cr.filmId);
        log(cr.name + "'s pact on “" + (f ? f.title : "a film") + "” ended.", "", "👋");
        S.social.creators.splice(i, 1);
      }
    }
  }

  if (chance(0.15) && S.projects.length) {
    var p = pick(S.projects);
    p.buzz = (p.buzz || 0) + 1;
    log("A clip from “" + p.title + "” caught fire — buzz +1.", "good", "📱");
  }
}

/* Opening mult: creator endorsements + the lead's own following.
   Merged v47 — this used to be defined twice (people.js and here). social_viral.js
   loads later, so the followers-based version in people.js was silently dead code
   and a star's follower count never moved an opening. Both effects now apply. */
function socialBuzzMult(p) {
  if (!S || !p) return 1;
  var m = 1, i;
  if (S.social && S.social.creators) {
    for (i = 0; i < S.social.creators.length; i++) {
      var cr = S.social.creators[i];
      if (cr.filmId === p.id && cr.weeksLeft > 0) m += cr.bonus * 0.01;
    }
  }
  /* the lead's followers: up to +15%, only when a lead is attached.
     seedFollowings() is idempotent, so calling it here keeps old saves (and any
     state built outside newGame) honest instead of silently returning 1. */
  if (typeof seedFollowings === "function") seedFollowings();
  if (typeof findTalent === "function" && p.actId) {
    var lead = findTalent(p.actId);
    if (lead && lead.followersK) m *= 1 + Math.min(0.15, lead.followersK / 4000);
  }
  return m;
}

function socialLaunch(targetId, tierIdx) {
  var tier = SOCIAL_CAMPAIGNS[tierIdx];
  if (!tier) return false;
  var target = findProject(targetId) || findFilm(targetId);
  if (!target) return false;
  if (S.studio.cash < tier.cost) return false;
  spend(tier.cost, "Viral campaign · " + tier.name + " · " + esc(target.title));
  target.buzz = (target.buzz || 0) + tier.buzz;
  S.social.campaigns.push({
    id: "soc" + (S.seq++), tier: tierIdx, filmId: target.id,
    cost: tier.cost, buzz: tier.buzz, weeksLeft: tier.weeks,
    week: S.studio.week
  });
  log("📱 “" + esc(tier.name) + "” on “" + esc(target.title) + "” — buzz +" + tier.buzz, "good", "📱");
  toast("📱 " + esc(tier.name) + " launched for “" + esc(target.title) + "”.", "good");
  return true;
}

function socialHire(creatorId) {
  var pool = socialPool(), i, cr = null;
  for (i = 0; i < pool.length; i++) if (pool[i].id === creatorId) { cr = pool[i]; break; }
  if (!cr || cr.hired) return false;
  var upfront = Math.round(cr.fee * 2 * 10) / 10;
  if (S.studio.cash < upfront) return false;
  spend(upfront, "Sign creator · " + esc(cr.name));
  cr.hired = true;
  cr.weeksLeft = ri(4, 8);
  S.social.creators.push({
    id: cr.id, name: cr.name, platform: cr.platform, tier: cr.tier,
    fee: cr.fee, bonus: cr.bonus, weeksLeft: cr.weeksLeft, filmId: null, hired: true
  });
  pool.splice(i, 1);
  log("🤝 Signed " + esc(cr.name) + " (" + esc(cr.platform) + ") — " + cr.weeksLeft + "-week pact.", "good", "🤝");
  toast("🤝 " + esc(cr.name) + " is now a creator ambassador.", "good");
  return true;
}

function socialAssign(creatorId, targetId) {
  var i, cr = null;
  for (i = 0; i < S.social.creators.length; i++) if (S.social.creators[i].id === creatorId) { cr = S.social.creators[i]; break; }
  if (!cr || cr.weeksLeft <= 0) return false;
  var target = findProject(targetId) || findFilm(targetId);
  if (!target) return false;
  cr.filmId = target.id;
  log("📢 " + esc(cr.name) + " endorses “" + esc(target.title) + "” on " + esc(cr.platform) + ".", "good", "📢");
  return true;
}

function socialAction(a, elx) {
  if (!S || typeof a !== "string" || a.indexOf("social-") !== 0) return false;
  socialEnsure();
  var id = elx && elx.getAttribute ? elx.getAttribute("data-id") : null;
  var key = elx && elx.getAttribute ? elx.getAttribute("data-key") : null;
  var ok = false;
  if (a === "social-launch") ok = socialLaunch(id, key != null ? +key : null);
  else if (a === "social-hire") ok = socialHire(id);
  else if (a === "social-assign") ok = socialAssign(id, key);
  else return false;
  if (ok) {
    saveGame();
    if (typeof render === "function") render();
    if (typeof drainFlash === "function") drainFlash();
  }
  return ok;
}

function socialDesk() {
  socialEnsure();
  var html = '<div>', i, pl, keys = Object.keys(S.social.platforms), c, cr, f, pool, cp, upfront;
  html += '<div class="sechead"><h2>Platforms</h2></div><div class="card">';
  for (i = 0; i < keys.length; i++) {
    pl = S.social.platforms[keys[i]];
    html += '<div class="statrow"><span class="k">' + pl.icon + " " + esc(pl.name) + '</span>'
      + '<span class="v">velocity ' + pl.velocity.toFixed(2) + ' · momentum ' + pl.momentum.toFixed(2)
      + (pl.trend ? ' · ' + esc(pl.trend) : '') + '</span></div>';
  }
  html += '</div>';

  html += '<div class="sechead"><h2>Active campaigns</h2></div>';
  if (!S.social.campaigns.length) {
    html += '<div class="card"><div class="empty"><span class="em">📱</span>No active viral campaigns.</div></div>';
  }
  for (i = 0; i < S.social.campaigns.length; i++) {
    c = S.social.campaigns[i];
    f = findProject(c.filmId) || findFilm(c.filmId);
    html += '<div class="card film"><div class="head"><div class="title">📱 ' + esc(SOCIAL_CAMPAIGNS[c.tier].name) + '</div>'
      + tag('+' + c.buzz + ' buzz', 'blue') + '</div>'
      + '<div class="statrow"><span class="k">Film</span><span class="v">' + esc(f ? f.title : c.filmId) + '</span></div>'
      + '<div class="statrow"><span class="k">Cost / left</span><span class="v">' + fm(c.cost) + ' · ' + c.weeksLeft + ' wk</span></div>'
      + '</div>';
  }

  html += '<div class="sechead"><h2>Creator ambassadors</h2></div>';
  if (!S.social.creators.length) {
    html += '<div class="card"><div class="empty"><span class="em">🤝</span>No creator ambassadors yet.</div></div>';
  }
  for (i = 0; i < S.social.creators.length; i++) {
    cr = S.social.creators[i];
    f = findProject(cr.filmId) || findFilm(cr.filmId);
    html += '<div class="card film"><div class="head"><div class="title">🤝 ' + esc(cr.name) + '</div>'
      + tag(cr.platform, 'blue') + '</div>'
      + '<div class="statrow"><span class="k">Fee / left</span><span class="v">' + fm(cr.fee) + '/wk · ' + cr.weeksLeft + ' wk</span></div>'
      + '<div class="statrow"><span class="k">Endorsing</span><span class="v">' + (f ? esc(f.title) : '— unassigned —') + '</span></div>'
      + '</div>';
  }

  html += '<div class="sechead"><h2>Hire a creator</h2></div>';
  pool = socialPool();
  if (!pool.length) {
    html += '<div class="card empty"><span class="em">👥</span>No creators available this week.</div>';
  }
  for (i = 0; i < pool.length; i++) {
    cp = pool[i];
    upfront = Math.round(cp.fee * 2 * 10) / 10;
    html += '<div class="card film"><div class="head"><div class="title">🤝 ' + esc(cp.name) + '</div>'
      + tag(cp.platform, 'blue') + '</div>'
      + '<div class="statrow"><span class="k">Tier ' + cp.tier + ' · open +' + cp.bonus + '%</span>'
      + '<span class="v">fee ' + fm(cp.fee) + '/wk</span></div>'
      + '<div class="statrow"><span class="k">Upfront (2 wks) ' + fm(upfront) + '</span>'
      + '<button class="btn ' + (S.studio.cash >= upfront ? "primary " : "") + 'sm" data-action="social-hire" data-id="' + cp.id + '">'
      + (S.studio.cash >= upfront ? "Hire" : "Too costly") + '</button></div></div>';
  }
  return html + "</div>";
}

var SOCIAL_DESKS = [
  { id: "social-desk", group: "Social", icon: "📱", name: "Social Viral",
    desc: "Platforms, viral campaigns and creator ambassadors that amplify film buzz.",
    render: socialDesk }
];
