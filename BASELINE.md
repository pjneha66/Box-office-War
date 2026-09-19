# Box Office War — Baseline (v5)

Date: 2026-09-19
Scope: existing game as-found, no logic changes.

## Architecture
- `index.html`: shell, start screen (`#startScreen`), app (`#app`), topbar chips, desktop tabs + mobile bottom nav, `#view`, `#modalRoot`, `#toasts`. Loads `data.js`, `engine.js`, `i18n.js`, `ui.js`. Registers `sw.js` only on http/localhost.
- `style.css`: dark cinematic theme, CSS vars, cards/chips/buttons/modals/toasts/charts, responsive `@media(max-width:760px)` + `@media(max-width:400px)`, `prefers-reduced-motion` guard, trend/stock/confetti styles.
- `data.js`: static data + RNG helpers (`rnd`, `rint`, `pick`, `chance`, `clamp`, `gauss`, `nid`). `DATA.GENRES` (15), `SGENRES`, `SCALES` (indie/mid/tentpole), calendar `WEEKS` + season multipliers, `PLATFORMS` + `NEWSTREAMERS`, `RIVALS_DEF` (3), `ARCHETYPES` (3), `DIFFICULTIES`, `SCENARIOS` (5), `RATINGS`, `WINDOWS`, `PATTERNS`, `ROLLOUTS`, `EXECS`, `FESTIVALS` (4), `SPORTS` (6), `IPKINDS`, talent pools, titles/blurbs, `UPGRADES`, `LOCATIONS` (6, rebate/cap/audit/treaty), `TIERS`, `MARKET`, `TREND`, `FATIGUE`, `CAREER`, `AI`, `GLOBAL`, `PRECURSORS`, `MKT_BOOSTS`, `PIRACY`, `MERCH_V2`, `MA`, `UNION`, `WAGE_INFLATION`, `TUT_STEPS`, `ACH` (30+), `EVENTS`, `COPROD_PARTNERS`, `AGENCIES` (3). `SAVE_VERSION=5`.
- `engine.js`: `G` global state, `newGame()`, `log`/`sfx` bus, `earn`/`spend` P&L ledger, versioned save/migrate/validate, calendar/money format, talent gen/careers, ideas/trends/fatigue, quality/box-office math, greenlight/production, test-screen/reshoot, theatrical tick, OTT licensing/auction/prebuy, series, rivals, chart, finance/forecast/loans/IPO/stock, streamer/sports, franchises/empire, festivals/awards/precursors, piracy/union/M&A/AI/global markets, events, tutorial, achievements, game-over.
- `ui.js`: tab router (`studio/develop/productions/boxoffice/ott/empire/finance`), top chips, wizards (greenlight/series/schedule), modals (auction/deepfake/FYC/empire/settings/help/earnings/share-card), WebAudio stings + haptics + confetti, gestures (swipe/pull), tutorial banner, i18n chrome.
- `i18n.js`: `en`/`hi` chrome dictionary, `t()`/`setLang()`/`applyChromeLang()`. Dynamic news stays English.
- `manifest.webmanifest`: standalone PWA, `icon.svg`.
- `sw.js`: cache-first `bow-v3-cache`, offline fallback to `index.html`.
- `test/smoke.js`: 5-year headless economy sim, asserts grosses/openings/ledger/rentals/franchises/reviews/trends/careers/stock/subs/fatigue + save migrate/corrupt reject.
- `test/ui-test.mjs`: jsdom click-through full flow (ROOT hardcoded to `/home/user/Box-office-War`, stale vs current folder).

## Game Loop / State
- Week tick via `▶ Next Week`, `⏩ ×4`, auto-play, long-press fast on mobile. `advanceWeek()` ticks projects, theatrical, OTT, series, rivals, finance, streamer, festivals, trends, fatigue, careers, piracy/union, events, earnings, save.
- State `G`: studio {cash/debt/rep/overhead}, week, projects/films/series/offers/ideas/franchises/talent/rivals/news/stats, streamer/sports/exhibitor/piracy/union/infl/wageInfl/trends/trendHist/agencies/M&A/deepfake/precursors/tutorial/AI flags, IPO/public, loans/mezz/output/wrap deals, achievements, slots.
- Save: `bow_save` + `bow_slotN` in localStorage, `v` stamped, `validateSave()` + `migrateSave()` steps 2-5, corrupt quarantined to `bow_save_broken`. Export/import via base64 code.

## Systems Present
- Film: script market → writer/director/cast/producer → budget/rating/location/polish/co-prod/plan/presales → pre/shoot/post/reshoot → ready → theatrical date + P&A + boosts/window/pattern/rollout/day-and-date → opening/legs/dom/intl/WW/rentals/PVOD/pay-1 → OTT offers/auction/library/re-release/reboot.
- Box office: `expectedOpening()` (stars×marketing×season×franchise×fatigue×trend×rep×competition×rating×premium×pattern×exhibitor), noise, legs from quality/genre/season/audience/piracy/pattern/embargo, 53% dom / 42% intl rentals, China quota/censor, staggered rollout, theater caps.
- Talent: actors/directors/writers/producers, power/skill/fee/heat/age/scandal/comeback/retire, loyalty discounts, backend, poaching, agencies + packaging fees + exclusives, yearly new-faces class.
- Franchises: unlock on hit, sequels/spinoffs/crossovers/DTV/TV spin-offs, tier/merch/park/games/resort/publishing/collabs/universe weave, heat/fatigue/decay timeline.
- Rivals: 3 styles (tentpole/prestige/balanced), yearly slate, corridors, weight-based competition, ytd/market share.
- Market: genre heat 0.78–1.28 quarterly mean-revert + perf feedback, season/holiday corridors, inflation 2%/yr + wage 3%/yr, trend board + sparklines.
- Finance: weekly P&L ledger, overhead, loans/mezz/investor debt, credit line from catalog + in-prod, 12-week forecast, execs, upgrades, IPO + share price/earnings/analysts/secondaries, M&A desk.
- Streaming/series: 5 platforms + entrants, licensing/prebuy/output deals/bidding wars, auction modal, series pitch→shoot→air→renew/cancel, own streamer (subs/ceiling/churn/tiers/day-and-date/library/sports), sports auctions, EU quota.
- Awards: 4 festivals + precursors + Golden Reels + FYC slider + Oscar bump + re-release.
- Events: ~20+ weekly pool (viral/piracy/scandal/strike/stream-war/new-streamer/caps/catalog/fest/investor/toxic/review-bomb/campaign/crackdown/spec/comeback/cofinance/AI-backlash/deepfake/EU/audit/agency-war/firesale) with choice modals.
- Progression: scenarios/difficulties/sandbox, rep/studio levels implicit, 30+ achievements, streamer/IPO/empire milestones.
- Audio/PWA/mobile: WebAudio stings, haptics toggle, confetti motion-aware, swipe tabs, pull-to-advance, bottom nav, PWA install/offline, sound/motion/text-size/Hindi settings.

## Working (static inspection)
- Boot/start screen, tabs, wizards, modals, toasts, charts, saves, Hindi toggle, forecast, auctions, streamer/IPO/sports/M&A/AI/global paths all wired in code. Smoke + UI tests encode expected flows.

## Broken / Risk (needs runtime confirm)
- `test/ui-test.mjs` `ROOT=/home/user/Box-office-War` mismatches current folder; run fails without edit.
- `sw.js` cache name `bow-v3-cache` stale vs `SAVE_VERSION=5`; offline bundle still lists core files so works but version unclear.
- No local run executed here (no shell in this session); console errors, perf numbers, save round-trip not yet observed live.

## UI / Gameplay Gaps
- Dating calendar crowding, competition explanation buried, legs/multiplier math opaque, franchise fatigue timeline thin, finance forecast assumptions hidden, event causes/consequences terse.
- Empty states (no films/offers/series) minimal, long ledgers/tables dense.

## Responsive
- Bottom nav + `g2/g3` grids collapse, `pick-list` single col, `#btnFast` hidden on mobile (long-press only), date chip hidden ≤400px. Needs 320/375/390/430/768/1024/1280/1440 pass + overflow/modal/chart checks.

## Accessibility
- Buttons mostly native, modal close on veil click, focus style weak, ARIA sparse, news feed dense, contrast generally dark-on-dark OK but badges/tags small, reduced-motion respected for charts/confetti, haptics/sound toggles present.

## Performance
- Vanilla HTML/CSS/JS, no frameworks, small assets. Risks: full `render()` innerHTML per tick, newsfeed ≤140, chart animations, confetti canvas. No bundle/build.

## Technical Debt
- Large globals (`G`, `WZ`, `SCHEDULE`), `engine.js` ~2980 lines, magic numbers inline, duplicated open-weight logic (`expectedOpening` vs `expectedWeightOf`), `G.log` aliasing, `ROOT` hardcode, cache/save version naming drift.

## Upgrade Opportunities
- Dashboard alerts/forecast/warnings, film-flow decision previews, box-office why-explainer + dom/intl/WW graph, rival profiles, talent arcs, franchise timeline, market report, finance transparency, progression/legacy, mobile/a11y polish, test portability.

## Next
- Serve via `python3 -m http.server 8080`, screenshot all tabs/modals/mobile widths, log console, verify save/import/slots/corrupt handling, then write `docs/GAME-UPGRADE-PLAN.md`.
