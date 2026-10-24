# GAME STUDIO DESK rebuild + subtab/bug fix + Kairo dev loop (v37.0)

Implementation record for PR **#20** (branch `arena/4aa21220-box-office-war`), at the same standard as the v36.0 LIBRARY DESK (PR #19) and v35.0 EMPIRE DESK. The user's request, verbatim in intent: *"new update redesign + BUG & SUBTAB inside old elements fix for tab Game Studio — first check old merge and repo, then check all bugs and fix it, then update this new feature in it … this big update so maintain PR properly."*

Order honoured: **(1)** audited the merged PR #19 + the repo, **(2)** fixed the Game Studio bugs, **(3)** shipped the new feature, **(4)** maintained the PR (docs, tests, version/cache pins).

---

## 0. Facts verified in the tree (before changes)

- HEAD was `c8b23bf` — PR #19 (Library Desk) merged. Baseline `node test/smoke.js` green.
- Game Studio was a *legacy mix*: `viewGames()` (`ui.js ~7935`) rendered legacy `.card`/`.subnav-pills` panels; the v16 adaptation pipeline (`engine.js startGameDev` / `releaseGame`), the in-house 8-phase GDD (`gamestudio-gdd-engine.js`, `PROTOTYPE_GAME_DEV`), and `gamedev-console-hardware.js` all coexisted with the tab.
- **The subtab bug:** `ui.js ~6910` set `GAMES_SUB` and re-rendered on `[data-gamestab]`, while a *second* binder at `ui.js ~7132` rebound the same selector to just `beep("click")` with the comment `Games tabs are view-only for now`. On top of that, the global `#subTabs` strip also drew Game Studio chips because `games` was missing from the single-branded-nav exclusion list (`ui.js ~2047`). Two nav systems, one of them dead.
- `startGameDev(srcKey, devId)` ignored the chosen `data-gplat` platform; `releaseGame` dropped it entirely. `portGame(id)` was called with no target; the button mislabelled a **$6M** cost as **"+$4M"**.
- The active `fmtM()` (`engine.js ~9485`, the currency-aware one) always prints **M**, so K-scale fees would render as **"$0.0M"**.
- Version unit was **36.0 / 51.2 / bow-v96** across `index.html`, `sw.js`, `package.json`, `version.json`.

## 1. Working rules followed

1. Test-first RED→GREEN where practical; one regression per named bug in the new suite. Bugs before features.
2. **No invented figures.** Every desk number reads live state through `GameStudioDesk` helpers. Projections are labelled as projections with their basis on screen.
3. **Honest refusal.** Engine helpers return `{ok:false, reason}`; the UI toasts the reason with **no** gold SFX / no flash / no modal close / no optimistic cash change. Unaffordable controls render `disabled` or refuse.
4. **Preserved selectors / engines.** `gameSources()`, `data-gsrc|gdev|gplat`, `#gsGo`, `data-pgdev-gdd`, `data-pgdev-choice`, the hardware modal, `portGame`, sequels — all still wired; only the *surface* was rebuilt.
5. **No new runtime deps, no build step, offline.** `gamestudio-desk.js` is a self-contained IIFE exposing `window.GameStudioDesk` / `module.exports`.
6. **Scoped CSS only** to `.command-games` in `command-deck.css`; no global `.view`/`.card` restyling; mobile `.bottomnav` clearance; no `overflow:hidden` masking of content.
7. `node --check` every touched JS; `git diff --check` clean.

## 2. Part A — bug fixes (each has a named regression in `test/game-studio-desk.mjs`)

- **A1 — dead duplicate subtab binder.** Removed both legacy `[data-gamestab]` handlers; added `games` to the single-nav and Kairo-banner exclusion lists. One persisted `data-gamessub` nav (7 chips), mirrored to `G.gameStudioDesk.sub`. Default `overview`.
- **A2 — `s.id` greenlight bug / nested legacy subtabs.** The whole legacy `viewGames()` block was replaced with the command-desk shell; no `.card`/`.section-title`/`.subnav-pills`/`.stat-hero` survives on any of the 7 sections (zero-legacy sweep, populated *and* empty). `gameDevLiteHTML()` was orphaned and deleted.
- **A3 — platform ignored.** `startGameDev(src, dev, platformId)` and `releaseGame` now persist the chosen target platform onto the project and the released record. Balance deliberately unchanged — the platform is cosmetic for the legacy adaptation pipeline.
- **A4 — `+$4M` port label + no target.** `[data-game-port]` now passes a chosen target from a per-row `data-gport-target` select into `portGame(id, target)`; the label states the real **−$6M** cost and **+38% rev**.
- **A5 — sequel right consumed on failure.** `[data-game-sequel]` set `g.isSequel = true` **before** the affordability check, so an unaffordable attempt permanently removed the button. Moved the mutation to after the cash check succeeds.
- **A6 — K-scale money renders "$0.0M".** Added `gsMoney()` (K-aware: `$10K`/`$500K`, M above 1) used across the desk for contracts, items, training, office, console, prizes — so a `$15K` contract no longer reads `$0.0M`.
- **A7 — micro-payment precision.** `_money()` and `itemPrice()` round to the nearest **$1K** (`roundK`), so K-scale fees/prices are no longer zeroed by the 0.1M helpers.
- **A8 — `your_console` sales fallback.** `salesPotential()` used the PC share for a proprietary console (the `||` short-circuited) and had confusing `(1 - royalty || 1)` precedence. It now uses the console's own installed-base share and a clean royalty multiplier.
- **A9 — double-unit `$…MM` labels.** Regression bans `\$\d[\d.,]*[MB]M` on every section; the root cause (K-scale values via `fmtM`) is fixed by A6.
- **A10 — emergency bailout too small at scale.** A literal $150K grant can't lift a negative movie-studio balance; the bailout now bridges to a +$5M working floor (one grace only) and logs the real injected figure. Second insolvency cancels the project.
- **Disproved / safe:** `GameDevHardware.tickWeekly` is only a *guarded* hook (the module never implemented it) — the v37 loop does not depend on it; proprietary-console royalties remain a documented open item, not a silent assumption.

## 3. Part B — the new feature (Kairo-style Game Studio loop)

`gamestudio-desk.js` owns `G.gameStudioDesk`; `engine.js advanceWeek()` calls the guarded `GameStudioDesk.tick(G)` weekly.

- **Phase 1 Planning** — platform + one of 20 genres + theme; allocate **8 company direction points** within an office-scaled capacity; in-house proposal author (Writing/Scenario level gates the Fun/Creativity foundation; failure yields low values) or outsourced author (flat $50K fee, predictable base).
- **Phase 2 Production** — 4 sequential milestones: **Alpha** 0–40% (Fun+Creativity via Coder/Writer), **Beta** 40–80% (Graphics via Designer), **Master** 80–100% (Sound via Sound Engineer), **Debug** 100%+ (feature-freeze bug-squash window). Rush/crunch speeds progress but breeds bugs.
- **Phase 3 Bugs/Research** — bugs from fatigue / low programming / crunch; each squashed bug grants **1 Research Data**; shipping with bugs cuts the review (**−3%/bug**, capped) and slashes sales/returns (`bugSalesMult`).
- **Phase 4 Reviews** — 4 critics × 1–10 = **/40**; 32+ Hall of Fame (unlocks sequels), 25–31 solid, <15 flop (fanbase damage). Genre×theme synergy (×1.35 great / ×0.55 disaster).
- **Phase 5 Sales** — 12-week decay (week 1 ≈30%, early peak, exponential tail), **December weeks 50–51 holiday surge +50–100%**, milestones 100K/1M/5M/10M/20M.
- **Phase 6 Events** — **July Game Dex** (booth tiers + staff costumes → hype + demographic fans, one booth/yr, hype banks to the next greenlight) and **December Global Game Awards** (Grand Prize, Runner Up, Best Graphics, Best Music, Worst — cash/fame effects).
- **Progression** — job tree Coder/Writer/Designer/Snd.Eng → Director → Producer → Hardware Eng → Hacker; 15 commercial platforms + **Your Console** (Large Studio + Hardware Engineer + $5M reserve, zero licensing); office expansion + cosmetic themes; outsourced contracts (deadlines, rep penalties); traveling salesman (May/November) with escalating boost prices + research costs; training that discovers new themes; secret legendary recruits; 32-title rolling catalog (purged Hall-of-Fame franchises lock sequels); consecutive-genre burnout (×0.40) and market saturation (same-genre −15% fans, same-theme halt, both −40% first-week).

## 4. Desk surface

Seven numbered sections — **Overview / Development / Catalog / Studio & Staff / Contracts / Awards / Hardware** — one persisted nav, live telemetry (research data, titles shipped, lifetime units, fanbase, trophies), real empty/onboarding states, and bounded rendering (catalog shows ≤24 rows). The **classic adaptation pipeline** and the **in-house 8-phase GDD pipeline** are preserved as desk panels; the legacy hardware/sabbatical desk is reachable via a modal.

## 5. Verification gates (all offline)

- `test/game-studio-desk.mjs` — **209 assertions**, engine unit + jsdom UI: founding, production, bugs/data, reviews, synergy, burnout, saturation, career tree, contracts, merchant, office/console, awards, **Game Dex**, bailout, 32-title buffer, desk nav/subtab persistence, zero-legacy sweep, `$…MM` ban, bounded catalog, and the A3/A4/A5/A6 bug regressions.
- `test/game-studio-desk-browser.cjs` — responsive 320/390/414/844/1024/1440, zero overflow/clipping, bottom-nav clearance, console-error-free, screenshots to `/tmp/gamestudio-shots`. Requires `puppeteer-core` + `@sparticuz/chromium` and a server on `:3000`; **skips gracefully** when those heavy dev deps are absent, so it is kept out of the default `test:management` chain (run via `npm run test:gamestudio:browser` in CI/dev).
- Updated the version-pinned assertions in `test/library-desk.mjs`, `test/ott-desk.mjs`, `test/empire-desk.mjs` (the last one also had its empire-CSS block extraction bounded so the appended games CSS isn't swept in).
- Full `npm run test:management` — **green** (109 PASS lines). `node test/ui-test.mjs` — **green** (24 checks). `node test/smoke.js` — **`ALL CHECKS PASSED [OK]`**.
- `node --check` on every touched JS; `git diff --check` clean.
- Version unit bumped to **37.0**: `index.html` meta `37.0`, `engine.js?v=48.0`, `ui.js?v=52.0`, `v31-features.js?v=47.3`, `command-deck.css?v=51.3`, new `gamestudio-desk.js?v=37.0`; `sw.js` `bow-v97-cache` + asset; `package.json` / `package-lock.json` `37.0.0`; `version.json` `37.0`. `NEXT_UPDATES` gained a shipped `37.0` entry.

## 6. Deliberately not changed / open items

- **No balance rebalance** of the legacy v16 adaptation pipeline — platform persistence is cosmetic there by design.
- `GameDevHardware.tickWeekly()` remains an unimplemented guarded hook (pre-existing); proprietary-console royalty payouts are not simulated.
- The full 18-hardware-platform catalog from the spec is represented by **15 commercial platforms + Your Console** in this build; adding the remaining named SKUs is a content-only follow-up.
- Browser screenshots are never committed; the `.cjs` gate skips cleanly on machines without the optional browser deps.

## 7. PR body must contain

1. The RED→GREEN lines for A1–A10 and the "disproved/safe" note for `tickWeekly`.
2. The relabel table (port `+$4M` → `−$6M · +38% rev`; sequel-mutation fix; K-scale money; bailout amount).
3. Zero-legacy sweep output, breakpoint matrix, node-count bound, and the exact test commands run.
4. Files touched + version pins + the `NEXT_UPDATES` bump.
5. Opened from the session branch, left **unmerged for review**.
