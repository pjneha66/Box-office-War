# v46 hook spec — eight feature modules

Read `rebuild-notes/module-contract.md` first. This file only adds the exact names.

**You create exactly two files**: `game/<mod>.js` and `test/rebuild-<mod>.mjs`.
**Do not edit** engine.js, ui.js, index.html, sw.js, build-www.js, meta.js or any other
module. The integrator (me) wires every hook listed below. If you need a hook that is not
listed here, implement around it and say so in your final answer.

Every hook below is called `typeof`-guarded from the engine, so a missing module never
breaks the game. Every module must survive being loaded with no state (old save) — use a
lazy `ensure()`.

## Shared rules (non-negotiable)

- ES5/ES2017 only: `var`, `function`, no arrows, no backticks, no `const`/`let`,
  no `?.`, no `??`, no `class`, no `Object.fromEntries`, no `.flat`.
- `"use strict";` at the top of the file.
- All state under exactly one namespace: `S.<ns>`.
- Money is $M. `fm(x)` for display, `esc(s)` for any string you render.
- Use only existing CSS classes. No inline `style="display:flex;..."`.
- `spend(amt, label)` / `earn(amt, label)` for every cash movement — never touch
  `S.studio.cash` directly.
- `log(txt, kind, ico)` max 1 line per week per module.
- Call `saveGame()` after every mutating action, then `render()`.
- Achievements: publish `var <MOD>_ACHIEVEMENTS = [ { id, tier, name, desc, test: fn(S) } ]`.
  `tier` is 1/2/3. `test` must be defensive (`return !!S.foo && ...`). `id` must be unique
  across the whole game — prefix it with your module name, e.g. `"rivalwar-share25"`.
- Desks: `var <MOD>_DESKS = [ { id, group, icon, name, desc, render } ]`.
  `render()` returns sheet body HTML only. Ids must be globally unique — prefix them.
- Actions: `function <mod>Action(a, elx)` returns `true` only if handled. Every button's
  `data-action` value must start with your module prefix.

## Module 1 — `game/rivals.js` (rival war room)

- State: `S.rivalwar`
- Tick: `tickRivalWar()` — weekly. Computes the player's market share, updates
  `S.rivalwar.shareHist` (cap 60 weeks), and decides rival reactions.
- Hooks:
  - `rivalWarShare()` → number 0..1, the player's share of industry gross this year.
  - `rivalReactionMult(rivalName)` → number, multiplier on that rival's opening next week.
    Rivals that are losing badly to you get aggressive (+); a rival you have crushed may
    retreat (< 1). Must return 1 when there is no reaction.
  - `rivalWarPoachBoost()` → number 0..1, extra poaching probability when you dominate.
  - `forecastAdjust_rivalwar()` → 0 (this module only moves cash at action time).
- Desks (`RIVAL_DESKS`, group `"Industry"`): `"rivalwar-share"` — industry ranking table
  (player + every rival, ytd gross, share %, rank, trend vs last week);
  `"rivalwar-war"` — rival reactions, taunts, poach threats, and the action buttons.
- Actions: `rivalwarAction` — at least one paid action, e.g. `"rivalwar-counter"` (buy a
  counter-programming slot against a named rival, costs cash, lifts your opening).
- Achievements: `RIVAL_ACHIEVEMENTS` — at least 4.
- Reads `S.rivals[].ytd` and `S.rivals[].lifetime` (the engine now accumulates both) and
  `S.studio.lifetime`. Never write them.

## Module 2 — `game/sequel.js` (sequel planning)

- State: `S.sequel`
- Tick: `tickSequel()` — weekly. Ages planned sequels toward their window.
- Hooks:
  - `sequelOpenMult(p)` → number. If `p.franchiseOf` matches a planned sequel entry, return
    a boost (decays with how many sequels you have already shipped in that franchise —
    fatigue). 1 when nothing applies.
  - `sequelCraftMod(p)` → number, craft add for a planned sequel (pre-planned sequels are
    better written).
  - `sequelOnRelease(f)` → called by the engine at release with the finished film; the
    module consumes the plan entry.
- Desks (`SEQUEL_DESKS`, group `"Empire & Franchises"`): `"sequel-plan"` — every finished
  film that qualifies (ww >= cost × 1.8, quality >= 60) with a "Plan sequel" button and a
  projected opening; planned sequels in flight with their week and cost.
- Actions: `sequelAction` — `"sequel-greenlight"` pays a development cost and creates a
  plan entry that the player can then launch from the normal development desk (the module
  must NOT splice `S.ideas`; instead it exposes `sequelIdea()` which the integrator wires,
  or it pushes to `S.ideas` via `genIdea(franchiseOf)` — pick one and document it).
  Prefer: `"sequel-greenlight"` calls the engine's `genIdea(title)` and pushes the result
  into `S.ideas`, then records the plan. Document this in the file header.
- Achievements: `SEQUEL_ACHIEVEMENTS` — at least 4.

## Module 3 — `game/craft.js` (craft departments)

- State: `S.craft`
- Tick: `tickCraft()` — weekly. Staff availability, department morale decay, contract
  renewals.
- Hooks:
  - `craftDeptMods(p)` → `{ craft, aud, legs }` numeric additions, all optional. Applied
    at computeQuality / releaseFilm. Must return zeros or null when nothing applies.
  - `craftCriticAdj(p)` → number, per-film critic add (sound mix / color grade quality).
- Desks (`CRAFT_DESKS`, group `"Production"`): `"craft-depts"` — the four departments
  (cinematography, production design, sound mix, pre-viz) each with a head, a weekly
  retainer, and their effect; `"craft-assign"` — assign a department head to a project in
  pre-production/shoot.
- Actions: `craftAction` — `"craft-hire"` (hire/replace a head), `"craft-assign"`
  (assign to a project), `"craft-fire"`.
- Achievements: `CRAFT_ACHIEVEMENTS` — at least 4.

## Module 4 — `game/mentor.js` (talent mentoring)

- State: `S.mentor`
- Tick: `tickMentor()` — weekly. Mentoring sessions progress; mentees gain skill on a
  schedule; the mentor's own output dips while mentoring.
- Hooks:
  - `mentorCraftMod(dirId, actId)` → number, craft add at computeQuality when the lead or
    director is a graduated mentee.
  - `mentorFeeMult(t)` → number, fee multiplier (loyal mentees take less).
  - `mentorSkillBonus(t)` → number, added to effective skill when evaluating a mentee.
- Desks (`MENTOR_DESKS`, group `"Talent"`): `"mentor-program"` — active mentorships with
  weeks remaining, projected skill gain, cost; `"mentor-pool"` — young talent (power <= 3,
  age <= 32) you can take on.
- Actions: `mentorAction` — `"mentor-start"` (pick mentor + mentee, pays a fee),
  `"mentor-stop"`.
- Achievements: `MENTOR_ACHIEVEMENTS` — at least 4.

## Module 5 — `game/legacy.js` (studio legacy tiers)

- State: `S.legacy`
- Tick: `tickLegacy()` — weekly. Accumulates legacy points from releases, awards,
  reputation and lifetime gross; promotes the studio through tiers.
- Hooks:
  - `legacyTier()` → number 0..5.
  - `legacyOpenMult(p)` → number, opening mult from the tier.
  - `legacyFinancingMult()` → number, mult on loan interest (lower is better).
  - `legacyFeeMult(t)` → number, mult on talent fees (lower is better).
  - `legacyRepBonus()` → number added to the reputation factor in `expectedOpening`.
- Desks (`LEGACY_DESKS`, group `"Empire & Franchises"`): `"legacy-tiers"` — the ladder
  (Indie label → Boutique → Mid-tier → Major → Studio system → Legacy house) with the
  player's current tier, points, progress to the next, and each tier's unlocks.
- Actions: `legacyAction` — at least one (e.g. `"legacy-endow"`: spend cash for legacy
  points).
- Achievements: `LEGACY_ACHIEVEMENTS` — at least 4.

## Module 6 — `game/window.js` (distribution window strategy)

- State: `S.win`
- Tick: `tickWindow()` — weekly. Advances window timers, fires PVOD/streaming windows.
- Hooks:
  - `windowRevenueMult(f)` → number, mult on the PVOD/streaming payout at endTheatrical
    (engine applies it). A short theatrical window means a bigger streaming cheque but
    fewer theatrical weeks; the module expresses that as this multiplier.
  - `windowLegsMult(f)` → number, mult on theatrical legs (long windows hold screens).
- Desks (`WINDOW_DESKS`, group `"Distribution"`): `"window-strategy"` — per-film window
  decision (theatrical-exclusive 90d / standard 45d / day-and-date 17d / PVOD-first 0d)
  with the projected trade-off in dollars; `"window-deals"` — streamer output deals that
  pay up front for a window commitment.
- Actions: `windowAction` — `"window-set"` (choose a window for a film before release),
  `"window-deal"` (sign an output deal).
- Achievements: `WINDOW_ACHIEVEMENTS` — at least 4.

## Module 7 — `game/labor.js` (union & labour relations)

- State: `S.labor`
- Tick: `tickLabor()` — weekly. Contract countdowns, guild mood, strike risk, negotiation
  windows.
- Hooks:
  - `laborCostMult()` → number, mult on production burn (replaces the flat `S.strike ? 1.2`
    with a relationship-driven number; the engine multiplies by it).
  - `laborStrikeMod()` → number, added to the weekly strike probability (negative when the
    guilds are happy).
- Desks (`LABOR_DESKS`, group `"Studio ops"`): `"labor-guilds"` — the four guilds
  (writers, actors, directors, crew/IATSE) with mood, contract expiry, and the current
  cost multiplier; `"labor-talks"` — open a negotiation (concede wages, offer residuals,
  offer back-end) with the outcome and risk shown before commit.
- Actions: `laborAction` — `"labor-concede"`, `"labor-negotiate"`, `"labor-lockout"`.
- Achievements: `LABOR_ACHIEVEMENTS` — at least 4.

## Module 8 — `game/awardsplus.js` (deeper awards night)

- State: `S.awp`
- Tick: `tickAwardsPlus()` — weekly (campaign decay).
- Hooks:
  - `awardsPlusCategories(yearFilms)` → called by `yearAwards()` **after**
    `extraAwardCategories`. Awards the craft and below-the-line categories: Best
    Cinematography, Best Production Design, Best Sound, Best Editing, Best Original Score,
    Best Ensemble. Each winner pays a small cash/rep bonus and records history.
  - `awardsPlusNominees()` → array of `{ cat, title, studio }` rival nominees to display.
- Desks (`AWARDSPLUS_DESKS`, group `"Awards"`): `"awp-history"` — every category, every
  year, player and rival winners; `"awp-campaign"` — per-film category campaigns with cost
  and odds.
- Actions: `awardsplusAction` — `"awp-campaign"` (buy a category campaign for a film).
- Achievements: `AWARDSPLUS_ACHIEVEMENTS` — at least 4.

## Test requirement

Each `test/rebuild-<mod>.mjs` follows `test/rebuild-consolehw.mjs`:
`vm.createContext` + stubbed `localStorage`, load `game/data.js`, `game/engine.js`, then
your module. `newGame("Test","veteran")`, drive >= 70 `advanceWeek()` calls, exercise every
action through your real `<mod>Action` (including one insufficient-cash rejection), assert
no throw, `S.studio.cash` finite every week, your namespace exists, every key field finite,
and at least one income/decay cycle moved. Print `PASS`/`FAIL` per check, exit non-zero on
failure.

Note: the engine already calls `tickRivalWar`/`tickSequel`/... once the integrator wires
them. Until then the harness must call your tick itself after each `advanceWeek()` — do
**not** double-tick if the engine already called it. Guard with your `lastTick` field:
`if (S.<ns>.lastTick === S.studio.week) return;` at the top of every tick. This makes the
double-tick impossible whether the engine wires you or not.
