/* ═══════════════════════════════════════════════════════════════════════════
   game/cast-bridge.js — connect the Box Office Sim 2 cast database to this
   build's state shape.

   WHY THIS EXISTS
   box-office-sim-2-cast.js was written for the legacy root build, where the
   game state is the global `G` and talent lives in `G.talent` as
   { kind, name, ... }.  This build (game/) keeps state in `S` and talent in
   `S.market` as { k, n, fit, ... }.  The two schemas do not overlap, so the
   generator's injectIntoTalentPool() and unlockAllCast() both returned early
   on `typeof G === "undefined"` — pressing "Unlock All Cast" did nothing here.

   This file bridges the gap instead of forking the generator:
     · BOS2.toGameTalent(rec)  maps a BOS2 record onto the game/ talent schema
     · window.bowUnlockAllCast() is the real implementation of the unlock
       action for this build (idempotent; safe to call repeatedly)

   Load AFTER box-office-sim-2-cast.js and BEFORE ui.js.
   ES5 only, matching game/engine.js and game/ui.js.
   ═══════════════════════════════════════════════════════════════════════════ */
"use strict";

(function (w) {
  var BRIDGE_VERSION = "1.0.0";

  /* The eight signature species the legacy build seeded on a new game. */
  var SEED_SPECIES = ["aard", "bear", "cat", "dog", "eagl", "lion", "pand", "wolf"];

  /* BOS2 ability descriptions → this build's ABILITIES ids. Matched by keyword
     so the generator's 121 flavour abilities all land on a real effect. */
  var ABILITY_RULES = [
    [/sequel/i, "franchise"],
    [/opening/i, "crowd"],
    [/streaming/i, "cult"],
    [/international/i, "intl"],
    [/legs/i, "legs"],
    [/critic/i, "shield"],
    [/fee|salary/i, "bankable"],
    [/week|fast/i, "fast"],
    [/quality|craft|skill/i, "improv"],
    [/award|prestige/i, "award"]
  ];

  function bos2() {
    return (w && w.BOS2_CAST) || (w && w.BOS2) || null;
  }

  function gameState() {
    /* `S` is declared with var in engine.js, so it is a global here. */
    if (typeof S === "undefined" || !S) return null;
    return S;
  }

  function genres() {
    return (typeof GENRES !== "undefined" && GENRES) ? GENRES : [];
  }

  function feesFor(kind) {
    if (kind === "actor") return (typeof FEE_ACTOR !== "undefined") ? FEE_ACTOR : [0.4, 1.5, 5, 12, 26];
    return (typeof FEE_DIR !== "undefined") ? FEE_DIR : [1.0, 2.5, 6, 11, 20];
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  function nextId() {
    var st = gameState();
    if (st && typeof st.seq === "number") return "t" + (st.seq++);
    return "t" + Math.floor(Math.random() * 900000 + 100000);
  }

  function randomGenreId() {
    var g = genres();
    if (!g.length) return "drama";
    return g[Math.floor(Math.random() * g.length)].id;
  }

  /* Map a BOS2 ability (id/n/d) onto one of this build's ability ids.
     Returns null when nothing matches, which is a valid "no ability". */
  function mapAbility(rec) {
    if (!rec) return null;
    var text = [rec.abilityName, rec.abilityDesc, rec.ability].join(" ");
    var i;
    for (i = 0; i < ABILITY_RULES.length; i++) {
      if (ABILITY_RULES[i][0].test(text)) {
        var id = ABILITY_RULES[i][1];
        return id;
      }
    }
    return null;
  }

  /* Convert one BOS2 record into this build's talent record.
     `kind` overrides the BOS2 `kind` field (animals are always actors here). */
  function toGameTalent(rec, kind) {
    if (!rec) return null;
    var k = kind || rec.kind || "actor";
    if (rec.isAnimal) k = "actor";
    if (k === "writer" || k === "producer") k = "dir"; /* no separate writer desks here */
    var power = clamp(Math.round(rec.power || 3), 1, 5);
    var feeTable = feesFor(k);

    var t = {
      id: nextId(),
      k: k,
      n: rec.name || rec.n || "Unknown",
      power: power,
      skill: clamp(Math.round(rec.skill || 60), 30, 97),
      fee: feeTable[power - 1],
      ability: mapAbility(rec),
      fit: rec.genreFit ? [rec.genreFit] : [randomGenreId()],
      age: clamp(Math.round(rec.age || 32), 18, 80),
      heat: rec.heat || 0,
      bookedUntil: 0
    };

    /* Preserve the BOS2 provenance so the cast directory can badge them and
       the unlock action stays idempotent (species is the dedupe key). */
    if (rec.bos2) t.bos2 = true;
    if (rec.isAnimal) {
      t.isAnimal = true;
      t.species = rec.species;
      t.habitat = rec.habitat;
    }
    return t;
  }

  /* Does the market already hold this BOS2 animal species? */
  function hasSpecies(speciesName) {
    var st = gameState(), i;
    if (!st || !st.market) return false;
    for (i = 0; i < st.market.length; i++) {
      if (st.market[i] && st.market[i].isAnimal && st.market[i].species === speciesName) return true;
    }
    return false;
  }

  function countBos2Humans() {
    var st = gameState(), i, n = 0;
    if (!st || !st.market) return 0;
    for (i = 0; i < st.market.length; i++) {
      if (st.market[i] && st.market[i].bos2 && !st.market[i].isAnimal) n++;
    }
    return n;
  }

  /* Add one animal actor per species that is not in the market yet. */
  function addAnimals(all) {
    var B = bos2(), st = gameState(), i;
    if (!B || !st || !Array.isArray(st.market)) return 0;
    var list = B.animals || [];
    var added = 0;
    for (i = 0; i < list.length; i++) {
      var sp = list[i];
      if (!sp || !sp.n) continue;
      if (!all && SEED_SPECIES.indexOf(sp.id) < 0) continue;
      if (hasSpecies(sp.n)) continue;
      var rec = B.generateAnimalActor ? B.generateAnimalActor(sp.id) : null;
      var t = toGameTalent(rec, "actor");
      if (!t) continue;
      /* The unlock promises a usable bench: 5 stars, high skill. */
      if (all) {
        t.power = 5;
        t.skill = Math.max(88, t.skill);
        t.fee = feesFor("actor")[4];
      }
      st.market.push(t);
      added++;
    }
    return added;
  }

  /* Add elite humans (4 actors, 1 director, 1 writer) if the market has none. */
  function addEliteHumans() {
    var B = bos2(), st = gameState(), i;
    if (!B || !st || !Array.isArray(st.market)) return 0;
    if (!B.generateHumanStar) return 0;
    var added = 0;
    var plan = ["actor", "actor", "actor", "actor", "director", "writer"];
    for (i = 0; i < plan.length; i++) {
      var rec = B.generateHumanStar(plan[i]);
      var t = toGameTalent(rec, plan[i] === "director" ? "dir" : plan[i]);
      if (!t) continue;
      t.power = 5;
      t.skill = Math.max(85, t.skill);
      t.fee = feesFor(t.k)[4];
      st.market.push(t);
      added++;
    }
    return added;
  }

  /* ── the real "Unlock All Cast" for this build ───────────────────
     Idempotent: calling it twice adds nothing the second time and only
     re-clears bookings/retirements, which is harmless. */
  function bowUnlockAllCast() {
    var st = gameState();
    if (!st || !Array.isArray(st.market)) return { err: "No game in progress." };

    var animalsAdded = addAnimals(true);
    var humansAdded = 0;
    if (countBos2Humans() === 0) humansAdded = addEliteHumans();

    /* Clear every lock: free, active, and available at any studio. */
    var i;
    for (i = 0; i < st.market.length; i++) {
      var t = st.market[i];
      if (!t) continue;
      t.bookedUntil = 0;
      if (t.retired) delete t.retired;
      if (t.retiredWeek) delete t.retiredWeek;
      t.scandal = 0;
      t.heat = Math.max(t.heat || 0, 1);
    }

    st.allCastUnlocked = true;

    var msg = "Unlocked the full cast: " + st.market.length + " performers on the market";
    if (animalsAdded || humansAdded) {
      msg += " (+" + animalsAdded + " animal stars, +" + humansAdded + " elite names)";
    }
    if (typeof log === "function") log("🔓 " + msg + ".", "gold", "🔓");
    if (typeof toast === "function") toast("Full cast unlocked — every performer is available.", "good");

    return { ok: true, added: animalsAdded + humansAdded, total: st.market.length };
  }

  /* Small helper the cast directory uses to badge BOS2-sourced performers. */
  function isBos2Talent(t) {
    return !!(t && (t.bos2 || t.isAnimal));
  }

  var api = {
    version: BRIDGE_VERSION,
    toGameTalent: toGameTalent,
    unlockAllCast: bowUnlockAllCast,
    isBos2Talent: isBos2Talent,
    hasSpecies: hasSpecies
  };

  w.BowCastBridge = api;
  /* The unlock action is looked up by name from ui.js, so expose it directly. */
  w.bowUnlockAllCast = bowUnlockAllCast;

  /* Keep the generator's own entry point pointing at the working one, so any
     existing caller of window.unlockAllCast() gets the bridged behaviour. */
  if (typeof w.unlockAllCast !== "function" || w.unlockAllCast === undefined) {
    w.unlockAllCast = bowUnlockAllCast;
  } else {
    w.unlockAllCast = bowUnlockAllCast;
  }
})(typeof window !== "undefined" ? window : this);
