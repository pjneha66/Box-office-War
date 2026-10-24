# Release Notes — Box Office War v39.1

## v39.1 — The Stage Division (Broadway, the West End and the road)

### New system
- **`stage-division.js`** — a self-contained live-theatre division on the Empire desk
  (`EMPIRE → STAGE`). Additive by construction: all state lives in `G.stage`, created on first
  touch, so every existing save loads untouched.
- **Houses**: The Yard Workshop (340 seats) → The Marquee Theatre (1,000) → The Empire Palace
  (1,800). Leased in order, gated on reputation and cash, each with an irreducible weekly upkeep.
- **Shows**: adapt any closed $40M+ film from the library (franchise entries carry a bigger
  built-in audience) or commission an original book. Five decisions — source, scale, composer,
  director, optional star — priced live in the form, with a projected review range.
- **Run**: 3 weeks of previews (with two $2.5M retools available), then opening night. Occupancy
  is driven by reviews, source, franchise, star and genre heat, decaying after week 10. Fixed
  house cost means a half-full room loses money; sell-out rooms pay for the whole division.
  Six weeks under 30% occupancy closes the show (as does week 156).
- **Recoupment**, **national tours** (24 weeks), **cast albums** (26 weeks, ×1.6 with a live music
  label), **staging licences** (one-shot lump sum) and an **annual Tony season at week 24** that
  lifts occupancy, gross multiplier and reputation.

### Wiring
- `engine.js` — `StageDivision.tick(G)` on the weekly tick, beside the other division ticks.
- `ui.js` — a sixth Empire section (`stage`), pixel-icon entry, and `bindEvents()` in `bindView()`.
- `finance-desk.js` — new `stage` ledger category (revenue → empire, costs → investment).
- `bow-restyle.css` — scoped stage styles (KPI strip, form grid, show cards) at the end of the file.
- `index.html`, `apk/build-www.js`, `sw.js` — the module ships in the browser, the APK and the
  offline cache. `test/smoke.js` assembles it for the headless harness.

### Verification
- `test/stage-division.mjs` — 11 regressions: lazy state, unlock/purchase gating, save/load,
  quote honesty, one-house-one-show, `advanceWeek()` wiring, recoupment, tour/album/licence gates,
  Tony season, the rendered desk + form, and the Treasury mapping.
- `npm test` chain now includes the stage suite; the smoke harness exercises a full
  greenlight → previews → opening → tour → album → close cycle.
- Full suites re-run green: smoke, ui-test, balance (6 seeds × 120 weeks), scenario playthrough
  (5/5), sandbox audit, empire desk (A1–C11).
- Visual check at 1280 and 390: zero document/#view overflow, no console errors.

---

# Launch Readiness — Box Office War v32.13

## v32.13 — 2D Kairosoft Simulation Suite, Box Office Sim 2 Talent Integration, GameStudio GDD Mechanics, Social Viral Network, and Sports Megadome Deals

### New Systems Implemented & Verified
- **2D Kairosoft Interactive Studio Rooms (`studio-lot-2d.js`, `kairo-theme-suite.js`)**:
  - 6 dedicated 16-bit departments: Studio Lot Campus, Soundstage A, Writers' Bungalow, Post & VFX Suite, Cinema Marquee, and Executive Penthouse.
  - Handcrafted pixel art scene backgrounds with animated department headers, pixel bulb borders, and CRT scanlines.
  - Micro-animated studio personnel: Writers typing screenplays, camera operators filming scenes, post editors cutting trailers, preview theater audiences reacting, and penthouse executives signing contracts.
  - Responsive stage switcher allowing fast navigation across all rooms with live production sync.
- **Box Office Sim 2 Full Cast Dataset (`box-office-sim-2-cast.js`)**:
  - Over 4,000 real-world talent records extracted from Box Office Sim 2 APK data across actors, directors, writers, and producers.
  - 72 character species and 121 specialized talent abilities with dynamic attribute tagging.
  - Backward-compatible integer ID casting translation layer preserving existing career saves.
- **GameStudio GDD Engine (`gamestudio-gdd-engine.js`)**:
  - Synthesized mechanics from Game Dev Story v2.6.9 and Game Dev Tycoon v1.6.18.
  - Topic x Genre synergy matrix with audience target weighting (Young, Teen, Mature).
  - Custom 2D/3D Game Engine R&D allocating technology, design, and graphics milestones.
  - 4 simulated gaming review publications (PixelPolygon, HyperJoy, BitCollider, EdgeOfPlay) with dynamic quotes, GameCon booth marketing, and Research Points economy.
- **Social Viral Network (`social-viral-network.js`)**:
  - Synthesized mechanics from Social Dev Story v2.5.1.
  - 4 digital social platforms (InstaBuzz, VidTok, ChirpNet, StreamTube) with real-time algorithm trend velocity and hashtag momentum.
  - 6 viral marketing blitz campaigns and digital creator ambassador endorsement pacts.
- **Sports Stadium Megadome Deals (`sports-stadium-deals.js`)**:
  - Synthesized mechanics from Idle Sports Stadium Tycoon v1.50.1.
  - Multi-tier stadium facilities: Seating capacity, VIP Skyboxes, Concessions Court, and Broadcast Jumbotron upgrades.
  - Corporate naming rights sponsorship contracts with Fortune 500 brands.
  - Exclusive live sports broadcast packages (Sunday Football, Championship Basketball, Grand Slam Tennis, Sunset Grand Prix, Apex Esports).
- **Landscape Orientation Lock & Offline Android APK**:
  - Android Manifest locked to sensorLandscape across all mobile and tablet form factors.
  - 55 modular engines, sound suites, and pixel art assets bundled directly into the standalone APK.

### Verification
- Full test suite green: Smoke simulation (261 weeks), UI harness (65/65 assertions), Balance harness (6 seeds x 120 weeks), Scenario playthroughs (5/5 win conditions), Creative Sandbox audit (9/9 steps), Library vault verification, and 6 narrative career arcs.
- Android APK compiled and assembled cleanly: `apk/dist/BoxOfficeWar-32.13.apk` (27MB) verified with bundled app-version metadata `32.13`.

---

## v31 — features restored that the notes promised but the code lost, plus three real bug fixes

An audit against the v28/v29 notes found features that existed only in the markdown — a past file
restore had dropped them from the working tree. v31 puts them back and fixes the bugs the audit
turned up along the way.

### Restored (new file `v31-features.js` + targeted `ui.js` wiring)
- **Animated SVG portraits** — `talentAvatarSVG(t)` builds a deterministic portrait per talent
  (seeded from id + name + kind): skin, hair silhouette, glasses, beard, role-coloured wardrobe,
  and one flourish per archetype (actor waves, writer writes, director claps, producer checks the
  clipboard). CSS-only idle bob / blink / hair drift / aura pulse, all gated behind
  `prefers-reduced-motion` and the in-game motion setting. Wired into the talent market, the talent
  profile and the cameo picker.
- **Charts + Box office analytics** — `renderBarChartSVG` / `renderPieChartSVG`, animated pure SVG.
  The Box Office tab gains an analytics block: All-time / this-year scope filter, top films by gross,
  domestic vs international, gross by genre.
- **Color-blind cues** — ✓ ✕ ◆ ▲ ▼ glyphs on green/red/gold tags and gains/losses, Settings toggle
  (default on, persisted). The state/applier already existed in ui.js; only the toggle was missing.
- **PWA install card** — Settings shows a real Install button driven by the captured
  `beforeinstallprompt` event, with a browser-menu fallback when the prompt isn't available.
- **What-if shareable links** — the sandbox fork parameters ride in the URL hash (`#wif=`), never
  the save; a "🔗 Share" button per scenario copies the link, and opening one auto-runs the fork.
  Supersedes the dead `checkWhatIfLink()` / `installPromptModal()` leftovers.
- **HQ floor-plan SVG** — the lot as a building map: 8 departments, dark = unbuilt, gold = partially
  equipped, green + glow = fully live.
- **Data-driven navigation** — `NAV_GROUPS` + `TAB_META` are now the single source of truth; the
  sub-tab strip is generated from data instead of six hardcoded branches.

### Bugs fixed (these were live, not theoretical)
- **Deepfake drill soft-lock** — the drill's Defer/Submit buttons were bound through
  `bindView(sel, fn)`, but `bindView()` takes no arguments, so the handlers never attached. With a
  sports auction pending, `advanceWeeks()` broke on the auction while `afterTick()` kept re-opening
  the unclosable drill ahead of it — **the week froze forever**. The drill is now fully playable
  (deterministic fake frames per event, countdown that misses on timeout, streak + win/loss
  counters) and the buttons are bound on the modal element.
- **Sub-tab strip ate its own bindings** — `renderSubTabs()` ran at the *end* of `bindView()`,
  replacing chip nodes that had just been bound, so the strip's chips were dead (the OTT market
  chip in particular). The strip now renders *before* the bindings attach.
- **Sparkline corruption** — `renderSparklineSVG` was called with an options object as its second
  argument in two places (buzz momentum on film cards, power trend on talent profiles), emitting
  `width="[object Object]"` / NaN coordinates. Now overloaded to accept both call styles.
- **Smoke-test calibration** — the economy assertion demanded `infl > 1.05`, which needs 3 year
  wraps, but a bankruptcy before week 157 left only 2 wraps (1.0404) and failed the run. The floor
  now scales with the wraps that actually ran.
- **Build/deploy script drift** — `apk/build-www.js` didn't copy `finance-tools.js` (hand-copied
  every release); it now lists every script, and `sw.js` precaches them too (cache bumped to
  `bow-v32-cache`) so offline play can't break the Finance/Analysis tabs.

### Verification
`npm test` green — engine smoke ✅ (5/5 repeat runs), **UI 62/62** ✅ (the test now inlines
`finance-tools.js` + `v31-features.js`, so the new code is actually exercised), balance harness ✅,
5 scenarios ✅, plus `npm run test:arcs` (six scripted careers). Responsive pass unchanged; real
Chrome headless boot check of the deployed URL clean.

---

## v29 — Tier 1–5 backlog pass, studio divisions, and the cert blocker closed

### Tier 1 — finished the half-built systems
- **OTT sub-tabs** — the OTT tab was one enormous scroll; it now has Home / Originals / Library /
  Finance / Sports / Deals with live counts, plus a catalogue panel that shows what's actually on
  the platform, what's licensed away, and what's free to move.
- **Board votes on real pitches** — the board used to vote only on tentpoles. Any pitch at or above
  `DATA.BOARD.voteAbove` ($60M) now goes to a vote, and the result is a **tally dialog** naming each
  member, their trait, their approval and how they voted.
- **Modal focus trap completed** — focus now moves into the dialog on open, returns to the triggering
  control on close, and the focusable list is recomputed per Tab so a re-rendered modal can't leak focus.
- **Deepfake drill** — difficulty tiers (3/6/9 frames), a real decision clock (14/10/7s — running out
  is a miss), a saved best streak, and win/loss counters.
- **Tech tree** — a layered SVG DAG with prerequisite lines coloured by state, plus an explicit
  `detail` string per tech showing the exact numbers, not a vague promise.
- **Trend board** — 4-quarter SVG sparklines and a Δ badge per genre.

### Tier 2 — feedback gaps
Court action now reports the relation change; import failures name the actual problem
(`importCodeReport()`); export confirms the clipboard write; **colour-blind cues** add ✓/✕/◆/▲▼
glyphs so hue is never the only signal (Settings toggle, on by default). The "reset all settings"
button already existed.

### Tier 3 — systems depth
Cast chemistry web on the film detail modal; the stock chart became an annotated SVG line marking
IPO, earnings beats/misses and capital raises; a 4-week talent-poaching cooldown plus a **poach-risk
badge** on talent cards; auto-play speed (1×/2×/4×); and a genre/season **heat overlay** on the
release calendar with a "best weeks" readout.

### Tier 4 — localization
Language metadata table, layout direction (`auto`/LTR/RTL) and numeral system (Western/Devanagari)
as settings, plus i18n keys for the repeating dynamic strings (roles, genres) used by `roleName()` /
`gName()`. **Correction:** Hindi is a left-to-right script, so `auto` resolves to LTR for Hindi —
the RTL option exists for genuinely right-to-left locales and for previewing, and the RTL CSS is real.

### Tier 5 — platform & release hygiene
PWA install card (captures `beforeinstallprompt`) and **real PNG icons** (192/512) generated from the
SVG and wired into the manifest; service-worker cache bumped to `bow-v29-cache`; what-if sandbox
forks are now **shareable links** that carry the numbers (not the save); an **HQ floor-plan SVG** that
lights up departments as you buy them; `test/arcs.js` scripts the six scenario arcs; and
`UPGRADE-REPORT.md` now records that the long-standing "suite never executed" blocker is **closed**.

### Studio divisions: games, merch store and comics
- The **Game Studio moved into the Studio group** (`Studio · Empire · Game Studio · Finance`), and the
  Studio tab opens with a **Studio divisions** panel: game development, merchandise store, publishing &
  comics, music label and streamer, each with its weekly income and a deep link.
- **Merchandise store** — a 4-level retail chain (`DATA.STORE`). Each level multiplies every
  franchise's merch income (compounding to ×2.63) and bills weekly upkeep; the web shop also earns on
  its own from catalogue breadth.
- **Comics** — `releaseComic()` launches a comic line on a franchise: a one-off launch spike, +1 rep,
  then a weekly back-issue tail that decays with the brand. Repeatable, and surfaced on both the Studio
  divisions panel and the Empire franchise card.
- **Bug fixed:** `launchPublishing()` charged $15M and earned **nothing** — `frWeeklyIncome()` counted
  only merch and parks. Publishing now pays weekly, so the publishing arm is no longer a pure loss.

### Button audit
A static audit cross-referenced every rendered `data-*` attribute against its readers and every inline
`onclick` against defined functions. Found and fixed **three genuinely dead buttons** — the Empire
podcast launcher, the streamer "library moves" list, and every cell of the release-calendar grid —
plus two dead bindings pointing at a misspelled `reReleaseFilm()` and a `viewStreamingDeal()` that
never existed (a real deal sheet now exists).

### Verification
`npm test` green — engine smoke ✅, **62/62** UI steps ✅, balance harness ✅ — plus `npm run test:arcs`
(six scripted careers, invariants asserted in each). Responsive pass at **320 / 375 / 430 px** with no
horizontal overflow. The 62nd UI step was added and two existing steps updated where the product
changed on purpose.

## v28 — Mobile UI refactor, promo pricing, charts & animated avatars

### Navigation: tabs → groups → sub-tabs
- The mobile bottom bar went from 8 cramped items to **5 groups** (Home · Studio · Create · Market · More).
- A new **sub-tab strip** under the topbar shows the sections of the active group, so all 11 sections stay one tap away.
- `NAV_GROUPS` / `TAB_META` in `ui.js` are the single source of truth; the desktop bar still lists every section and the sub-tab strip hides above 760px.
- "More" is now a grouped directory of every section plus the studio tools (awards, hall of fame, settings, help, save).
- Keyboard shortcuts, swipe gestures and deep links (`switchTab('finance')`) all follow the new order; i18n covers the new group labels.

### Home and Studio are now different screens
- **Home** = *this week*: week hero with net delta, "Needs you now" task list with jump buttons, next-week preview, an 8-week net bar chart, live runs, active modifiers, headlines.
- **Studio** = *the studio itself*: the 13-tile identity hero, control-room grid, market share, DNA, reputation, progression, legacy and the full industry feed.

### Pricing: cameo + promo/demo tier
- `cameoQuote()` / `cameoWizardCost()` are now the single source of truth. The roster card used to advertise **$500k** while the engine paid `power × 0.7`, and it only accepted 5★ stars while the button showed from 4★ — power-4 actors failed silently. Both fixed.
- Promo/demo rates: studios under rep 45 see the discounted rate, with the list price struck through.
- New **promo (demo) tier** for the streamer; `tierQuote()` returns `{cost, list, promo}` so the label and the charge can never disagree, and the failure toast explains the cash shortfall.

### Charts & number formatting
- `renderBarChartSVG` and `renderPieChartSVG` — animated, pure SVG, no chart library.
- Box Office gains a **Box office analytics** block: scope filter (all-time / this year), top films by gross, domestic vs international pie, gross by genre, gross by year.
- Locale-aware formatting layer in `engine.js`: `fmtInt` / `fmtNum` / `fmtPct` / `fmtMoney` plus grouped `fmtM` / `fmtG` / `fmtSubs`, memoised `Intl.NumberFormat` instances, and NaN/Infinity guards.

### Karisoft-style animated avatars
- `talentAvatarSVG(t)` builds a deterministic SVG portrait per talent (seeded from id + name + role): skin, hair silhouette, glasses, beard, role-coloured wardrobe.
- CSS-only animation: idle bob, blink, hair drift, aura pulse, plus one flourish per archetype — waving hand (actor), scratching pen + page (writer), nodding clapperboard (director), ticking clipboard (producer).
- Wired into talent cards, crew cards, the cameo picker, the talent profile and the RPG character sheet; all keyframes are gated behind `prefers-reduced-motion`.

### Filters that actually work
- **Dead filters fixed**: the script-market genre chips (`data-filter-genre`) and the inline Library chip bar (`data-lib-*`) were rendered but never bound; `G.libFilter` was read but never initialised.
- New filters: Box Office scope + genre + title search, Library title search, Productions stage counts, Fan-mail categories, OTT series stage, Empire franchise state, Game Studio review bands, Finance ledger search + bucket.
- All filter rows share one `.fchip` component with live counts and empty states.

### Bug sweep
- Removed 4 undefined CSS custom properties (`--pos`, `--neg`, `--bad`, `--muted`) and added the missing design tokens the UI referenced (`--live-red`, `--radius*`, `--card-hover`, `--h` fallback).
- `renderSparklineSVG` accepted positional args but was called with an options object, emitting `width="[object Object]"` in two places — now overloaded.
- `reReleaseFilm()` (misspelled) and `viewStreamingDeal()` (never defined) were wired to dead selectors; re-release now works from the film modal and a real streaming deal sheet was added.
- The film-detail cast list printed `c.emoji` (undefined) — now shows animated portraits.
- `animation-fill-mode: both` on 10 entrance animations meant content stayed invisible if animations were throttled; all converted to `forwards`.
- Perf: memoised `Intl.NumberFormat` (the UI test went from 162s back to ~75s).

## v27 — Shippable Product Plan (Phases 1–6)

Status snapshot for the full Shippable Product Plan (Phases 1–6). Everything below ships in this build.

## What's in (by phase)

### Phase 1–2 — Full RPG Character System
- 9-grid alignment: 3 work styles (Lawful/Neutral/Chaotic) × 3 morals (Good/Neutral/Ruthless) with production + personal effects
- 3 skill branches × 4 talent types (12 trees, 44 nodes), prerequisites, aggregated production bonuses
- 4 equipment slots (Weapon/Armor/Accessory/Prop), 5 rarities, effective-attribute computation
- Relationship web (bonds from collaborations, life events; friends/rivals at ±5 strength)
- Mentorship (3+ level gap, weekly XP transfer, milestone on formation)
- Expanded life events: 6 event families incl. social/mentorship/feud with relationship effects
- Guilds per craft with weekly dues + professional-development skill points

### Phase 3 — Game Dev Expansion
- GDD modal: 7 genres × 5 platforms × 5 themes × 5 mechanics × 6 business models, with synergy scoring and budget preview
- 8 dev phases (pre → prototype → vertical slice → alpha → beta → content complete → gold → launch) with per-phase choices and cost weights
- Team composition (up to 5 roster talents, their RPG stats drive quality)
- Weekly sales tails per monetization model (premium/DLC/F2P+IAP/sub/ads/freemium)
- Live ops: weekly event rolls (patches, content drops, expansions, film crossovers) that refresh sales
- Annual Game of the Year award

### Phase 4 — Economy
- 4 currencies: cash, reputation, fame/infamy (per talent), influence (studio-level)
- Influence sinks: masterclass intensives (+1000 XP), hype surge (+10% next opening)
- Influence sources: awards, smash hits, acclaimed launches, GOTY

### Phase 5 — Production Readiness
- Accessibility: aria labels on icon buttons/dialogs, `aria-current` on tabs, focus trap + Escape in modals, reduced-motion support (existing), landmarks (`<main>`)
- i18n: en/hi chrome strings incl. new sections; dynamic game copy stays English by design
- Privacy/GDPR: first-boot consent, Privacy & Data modal with full JSON export and delete-everything wipe; no network calls, no accounts
- Tutorial: extended with RPG-sheet and in-house-games steps
- Balance harness: `npm run balance` — 6 seeds × 120 weeks, ~1,300 assertions (cash finite, XP flow, level bounds, event rate caps, game pipeline reachable, rep band)
- Security: SSRF-guarded fetch (literal URL, key in header), static-require test bundles (no vm/eval)

### Phase 6 — Launch Polish
- Guilds, game awards, achievements (+8 new: level 10, 3 games, mentorship, 4 slots, 4 genres, 50 influence, 3 guild members, 3 live-ops)
- Streamer churn prediction (weekly warning + OTT dashboard risk badge)
- Mod support: `window.BOW_MODS = { data:{...}, onBoot:[fn] }` hook merged at boot
- This checklist

## Known scope cuts (honest list)
- Full WCAG audit / screen-reader pass NOT done — targeted a11y only
- Hindi covers chrome only; long-form news/events remain English
- COPPA: no age gate (no data collection exists at all); add one before any store submission targeting kids
- Mod support is a data/boot hook, not a content pipeline or workshop integration
- Balance harness validates sanity bands, not competitive meta

## Pre-launch checklist
- [x] `npm test` green (smoke + 60+ UI steps + balance harness)
- [x] Repeated-run stability (3× clean)
- [x] Deployed to production (Vercel)
- [x] Save migration from v13 schema (prototype fields ride the whole-G snapshot)
- [x] Store listing assets — PWA PNG icons (icon-512/192/180.png, v28.4) + store screenshots (assets/store/: start-desktop, studio-desktop, develop-desktop, studio-mobile — rendered v28.9)
- [ ] Screen-reader pass with a real NVDA/VoiceOver run (static ARIA audit + keyboard nav done in v28.7/28.9; needs human ears)
- [ ] §83 modularization — incremental by design (new systems get their own engine sections); no big-bang rewrite planned
- [ ] 30-min human playtest vs. Go/No-Go criteria in `.opencode/plans/prototype_plan.md`
