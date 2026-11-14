# Rebuild feature-module contract (READ THIS FIRST)

You are adding one feature module to the rebuilt game in `game/`. The rebuild is a clean,
phone-first tycoon (see rebuild-notes/REBUILD-REPORT.md). Your module adds a set of
simulation systems + their UI desks. **You create exactly two files**: `game/<mod>.js`
and `test/rebuild-<mod>.mjs`. You must NOT edit any other file (engine.js/ui.js/index.html
are wired by the integrator). If a hook you need is missing, implement around it and note
it in your final answer.

## Reading list (read all before writing)
- `game/engine.js` — the sim: helpers, `S` state, `advanceWeek()` pipeline, earn/spend/log/toast
- `game/ui.js` — views, sheets, action delegation (bottom: `onAction`), toast queue
- `game/style.css` — the ONLY stylesheet; use its classes, never invent styling
- `game/data.js` — GENRES/SCALES/MKT_TIERS/ORIGINS/CRITICS/name banks
- `rebuild-notes/REBUILD-REPORT.md` — context

## Global helpers available (defined in engine.js / ui.js / data.js)
- Math/rand: `ri(a,b) rf(a,b) pick(arr) chance(p) clamp(x,lo,hi) gauss()`
- Money/format: `fm(x)` → "$12.3M", `esc(s)` HTML-escape
- Domain: `genreOf(id) scaleOf(id) seasonOf(woy) woyOf(week)` — `woyOf(S.studio.week)`
- Lookups: `findTalent(id) findProject(id) findFilm(id) findIdea(id) talentBusy(t) feeFor(t,budget)`
- Ledger: `spend(amount, label)` `earn(amount, label)` (also record weekTx rows)
- Logging: `log(txt, kind, ico)` → news feed ("good"/"bad"/"gold"/"") · `toast(txt, kind)` → queued toast
- `saveGame()` after any state change
- UI: `tag(txt, cls)` `statrow(k, vHTML, vClass)` `chartHTML(rows)` `openSheet(html)`
  `rerenderSheet(html)` `closeSheet()` `pushToast(txt, kind)` `render()` (re-render current view)

## State conventions (CRITICAL)
- All your state lives under ONE namespace: `S.tv` / `S.emp` / `S.pr` / `S.biz` (per your module).
- Old saves already exist without your fields → **lazy ensure**: an `ensure()` function that
  creates the namespace if absent; call it at the top of your tick AND every render/action.
- Ids: `"tv1"` style via `"tv" + (S.seq++)`.
- Money in $M (fractions ok, round display via `fm`). Never store NaN — validate inputs.

## Wiring contract (the integrator already added these hooks in engine.js / ui.js)
1. **Weekly tick**: engine's `advanceWeek()` calls, after its own systems:
   `if (typeof tickTV === "function") tickTV();` (same for tickEmpire / tickPR / tickBiz).
   Define `tick<Mod>()` — advance the week for all your systems (income, decay, offers,
   renewals, expiries). Use `log()` for anything the player should read; max ~2 logs/week.
2. **Actions**: ui's `onAction(a, elx)` tries, in order:
   `tvAction(a, elx)` then empire/pr/biz (first to return true wins).
   Define `<mod>Action(a, elx)` → return `true` if you handled the action, else `false`.
   Buttons in your HTML: `<button data-action="tv-launch-streamer" data-id="...">`.
   Read args via `elx.getAttribute("data-id" | "data-key")`.
   After every mutating action: `saveGame(); render();` (+ `drainFlash()` if you used toast()).
3. **Desks**: define `var TV_DESKS = [ ... ]` (EMPIRE_DESKS / PR_DESKS / BIZ_DESKS). Entry shape:
   `{ id: "tv-streamer", group: "TV & Streaming", icon: "📺", name: "Streaming platform",
      desc: "Launch your own streamer...", render: function () { return BODY_HTML; } }`
   `render()` returns ONLY the sheet body inner HTML (no .sheet-head/.sheet-foot — the shell
   provides the title bar from `name`). It must call your `ensure()` first and reflect live state.
4. **Engine hooks** (already inserted, typeof-guarded — define only what you need):
   - `awardPoints(filmId)` → number (PR: FYC points for year-end awards)
   - `prRetainer()` → true while a crisis retainer is active (PR)
   - `bizOpenMult(project)` → opening multiplier (chains/IMAX) · `bizQualityBonus(project)` → craft bonus
     · `bizIntlBonus()` → added to intlShare (0..0.1) · `bizLocationMods(project)` →
     `{ craft, costMult, rebate, intlBonus }` or null · `espAnnounceWindow()` → weeks ahead rivals announce
   - `presaleShare(film)` → 0..0.25 share of international rentals pre-sold (deducted by engine)

## UI rules (the whole point of the rebuild — do not regress them)
- Portrait-first, single column. Sheets scroll; keep each desk readable in one scroll.
- Use existing classes only: `.card .film .statrow .tag(.gold/.green/.red/.blue) .btn(.primary/.danger/.sm/.block/.grow)
  .seg button.on .field-label .text-input .talent-row .person .bar(.green/.red) .chart .c .news-item .empty .btnrow`
- Buttons ≥ `.btn.sm` (38px). NO inline `style="display:flex;gap:..."` (flex gap breaks old WebViews) — use `.btnrow` or `.film .foot` patterns.
- ES2017-safe JS only: no `?.`, no `??`, no `.flat/.flatMap`, no `Object.fromEntries`, no `globalThis`.
- Escape ALL user/domain strings with `esc()`; money via `fm()`.
- Empty state: `<div class="empty"><span class="em">📺</span>message</div>`.
- One decision per tap. Show costs and cash-after before commit buttons; disable buttons with
  `[disabled]` when unaffordable.

## Desk body pattern (copy this shape)
```html
<div class="card">
  <div class="statrow"><span class="k">Subscribers</span><span class="v num">4.2M</span></div>
  <div class="statrow"><span class="k">Weekly net</span><span class="v num up">+$1.8M</span></div>
</div>
<div class="sechead"><h2>Actions</h2></div>
<div class="card">
  <div class="statrow"><span class="k">License a library title ($9.0M)</span>
    <button class="btn sm" data-action="tv-license">License</button></div>
  <div class="statrow"><span class="k">Greenlight exclusive ($25M)</span>
    <button class="btn primary sm" data-action="tv-exclusive">Produce</button></div>
</div>
```

## Test requirement (test/rebuild-<mod>.mjs)
Node vm harness (copy the pattern from test/rebuild-sim.mjs — createContext + runInContext
with a stubbed localStorage). Load `game/data.js`, `game/engine.js`, then YOUR `game/<mod>.js`.
Then: `newGame('Test','veteran')`, drive ≥ 60 `advanceWeek()` calls while exercising every
system through your real functions (launch/produce/cancel paths, incl. one insufficient-cash
rejection). Assert: no throw, `S.studio.cash` finite every week, your namespace exists, each
system's key fields finite, and at least one income/decay cycle actually moved. Print one line
per check; exit non-zero on failure. Iterate until it passes.

## Code style
`"use strict";` at top. function declarations (globals). Small named functions per mechanic.
Comments only where the mechanic is non-obvious. Target ≤ ~900 lines including the desk UI.

## Wave-2 addendum (read after the main contract)
The integrator hooks are LIVE: engine.js calls tickTV/tickEmpire/tickPR/tickBiz and ui.js
bridges tvAction/empireAction/prAction/bizAction then auto-refreshes the open desk sheet.
**Do NOT self-wrap advanceWeek/onAction — the wrappers were removed.**
New shared facts:
- The release sheet (ui.js) sets `p.window` = 17 | 45 | 90 (theatrical window in days, default 45).
- New optional hooks you may define (typeof-guarded by the integrator):
  - `chainWindowBump(windowDays)` — engine calls it at release; adjust theater-chain relations (17 → −8, 90 → +6).
  - `filmTerritoryRows(film)` — return HTML rows (use .statrow) for a film's international territory split; the film detail sheet appends it.
  - `forecastAdjust(weekAbs)` — return that week's net $M adjustment from your systems (streamer net, syndication royalties, game sales…); engine's 12-week cashflow forecast adds it.
  - `empRecoupCount()` — number of recouped stage shows (scenario win check).
- New module ids: game/ott.js (OTT_DESKS + tickOTT + ottAction), game/games.js (GAMES_DESKS + tickGames + gamesAction), game/library.js (LIB_DESKS + tickLibrary + libAction).
- ui.js render() already has a "more" case; groups render in first-appearance order.

## Wave-3 addendum (hooks are LIVE — do not self-wrap)
engine.js now calls (all typeof-guarded): tickTV/tickEmpire/tickPR/tickBiz/tickOTT/tickGames/tickLibrary/tickExhibition/tickCreative.
ui.js onAction bridges: tvAction/empireAction/prAction/bizAction/ottAction/gamesAction/libAction/exhibitionAction/creativeAction/financeAction/challengeAction.
collectDesks concatenates: TV/EMPIRE/PR/BIZ/OTT/GAMES/LIB/EXHIBITION/CREATIVE/FINANCE/CHALLENGE_DESKS.
New optional hooks (define only what you need):
- exhibitionGrossMult(film) → mult on weekly theatrical gross (owned screens) · rentalSplitMult() → mult on rental share (concession deals) · plfOpeningMult(project) → opening mult (PLF mastering)
- creativeProjectMods(project) → {craft, aud, legs} additions (camera/spark/writers/quadrants/doctor)
- franchiseOpeningMult(project) → mult (universe/fatigue) · espionageSuppression(rivalName) → mult on that rival's opening
- imprintOpeningMult(project) → opening mult · imprintCriticBonus(project) → critic add
- challengeMod() → {interestMult, overheadMult, startCashMult} from S.challenge (engine applies interest/overhead; startCashMult applied at newGame)
- forecastAdjust(weekAbs) already exists; empRecoupCount() optional.
engine.js now also: f.revShare (0..0.6) deducted from intl rentals at endTheatrical; cult_icon ability boosts PVOD ×1.35.
New files this wave: game/exhibition.js, game/creative.js, game/finance.js, game/challenges.js, game/i18n.js.

## Wave-4 addendum
New optional typeof-guarded hooks (engine calls them; define only what you need):
- chemCraftMod(dirId, actId) → craft add (casting chemistry) · chemOpenMult(p) → opening mult
- socialBuzzMult(p) → opening mult from lead's social following · ticketPricingMult(p) → opening mult (pricing strategy)
- criticRelAdj(criticName) → per-critic review score add (critics relationships)
- checkAchievements() → called weekly (achievements module)
New files this wave: game/posters.js (posterSVG(film) → svg string; POSTER_DESKS), game/people.js (PEOPLE_DESKS + tickPeople + peopleAction), game/media.js (MEDIA_DESKS + tickMedia + mediaAction), game/strategy.js (STRATEGY_DESKS + tickStrategy + strategyAction), game/meta.js (META_DESKS + metaAction; achievements checkAchievements()).
Rules unchanged: no self-wrapping, own files only, tests via vm harness calling your tick after advanceWeek.

## Wave-5 addendum
New optional typeof-guarded hooks (define only what you need):
- techCraftBonus() → craft add on every film · techOpenMult() → opening mult (tech tree, tech.js)
- premiereApply(p) → called at releaseFilm with the project (premiere plans, events2.js)
- awardNightBegin(nominees) → called by yearAwards instead of auto-award when defined; nominees = [{id,title,quality}]; module resolves via S.pending and applies bonuses (events2.js)
- rivalDealClash(rivalName) → mult on that rival's opening vs your films (negotiation pacts, bizdeal.js)
- hasPactWith(rivalName) → true blocks that rival's poaching attempts (bizdeal.js)
- screenCountMult(p) → opening mult from negotiated screen counts (bizdeal.js)
- crisisYearRoll() → called at year boundary; module may set a crisis year (events2.js)
- tutorialBanner() → returns HTML banner for current view (ui render calls it guarded; meta2.js)
- slots.js: save-slot manager via snapshot copies in localStorage key 'bow2.slots'; expose slotPickerHTML() for the start screen.
- PREFS.frame (poster frame style, slots/theme extras write it; posters.js posterSVG reads it).
New files: game/tech.js, game/events2.js, game/bizdeal.js, game/slots.js, game/meta2.js.

## Wave-6 addendum
New optional typeof-guarded hooks:
- crewMods(p) → {craft} add at computeQuality (crew.js: DP/editor/composer bonuses)
- masteryCraftMod(genre) → craft add · masteryOpenMult(genre) → opening mult (mastery.js)
- agencyFeeMult(talent) → mult on talent fee (mastery.js agency relationships)
- filmEndBonuses(f) → [{label, amt}] earned at endTheatrical (composer soundtrack income, licensing? no — licensing is its own weekly)
- extraAwardCategories(yearFilms) → called after Best Picture at yearAwards (awards expansion)
- Production choices are ENGINE functions now (integrator added): rushFilm(pid) $=budget*0.12 → shoot −1 wk; extendFilm(pid) $=budget*0.05 → shoot +1 wk & +3 craft (p.extendCraft); reshootScene(pid) $=budget*0.06 → +2 craft once — crew.js desks call these.
New files: game/crew.js (CREW_DESKS + tickCrew + crewAction), game/mastery.js (MASTERY_DESKS + masteryAction), game/world.js (WORLD_DESKS + tickWorld + worldAction), game/licensing.js (LICENSING_DESKS + tickLicensing + licensingAction), game/festivals.js (FESTIVAL_DESKS + festivalAction; may edit game/empire.js minimally for universe expansion).
