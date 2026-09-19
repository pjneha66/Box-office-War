# Box Office War Upgrade Report

Date: 2026-09-19
Scope: incremental UI upgrades on the existing HTML/CSS/JS game. No framework, no backend, no new dependencies.

## Summary

The existing simulation was preserved intact. Upgrades are presentation layers over existing state plus two small engine fixes. Live browser QA walked new-game → dashboard → film creation → casting → production → dating → theatrical → charts → finance → talent → franchise → rivals → save/load on desktop and 390px mobile. The automated suite was extended but not executed (no shell in this session).

## Existing Game

Preserved: week-tick loop, P&L ledger, box-office math (opening/legs/splits), production phases, OTT licensing/auctions/prebuys, series, rivals slate/chicken/poaching, genre trends, finance/debt/IPO/stock, streamer/sports, franchises/empire, festivals/awards, piracy/union/M&A/AI/global markets, events, tutorial, achievements, versioned saves + migrations, Hindi/English chrome, PWA shell. No mechanic was rebalanced; no feature removed.

## Dashboard

`ui.js` `viewStudio` + new `studioOpsCard`. Stat hero grew to 13 cards: cash, revenue (12w trailing), profit (12w), debt, studio value, reputation, date, active productions, upcoming releases, YTD box office, streaming subs, franchise heat, year awards. New control-room grid: warnings, deadlines, production, market, rivals, recent — all read-only rollups of existing state with tab shortcuts. Scenario row, meters, awards card, market share, achievements, share card, news feed unchanged.

## Film Flow

`ui.js` wizard + productions. New 10-stage pipeline strip (Concept → Streaming) in the greenlight wizard and productions view. Per-step decision-impact cards (writer/director/cast/producer/budget) showing cost, script/quality effect, opening effect, and risk, computed from existing helpers (`writerBonus`, `actorFee`, `recMarketing`, `breakevenWW`, `legsOf`, `trendOf`). Production cards gained next-action hints; ready films gained a release-readiness line (test status, P&A guide, legs estimate); the dating modal gained cost/risk/quality rows. Greenlight logic untouched.

## Box Office

`ui.js` `viewBoxOffice` + helpers `boSplit`/`boMult`/`boLegs`/`boWhy`. Live runs show stat grid (opening, domestic, international est., worldwide, multiplier, legs, critics, audience), weekly rental figures, run-health %, and a "Why is this performing this way?" factor list (star power, P&A vs guide, audience/critics, holiday, genre heat, franchise, competition at release week, scandal, review bombing, piracy, day-and-date). Library rows show multiplier/legs/scores. Theater counts and occupancy are not in the engine, so no fake numbers were invented — run health is labeled as opening-relative.

## Talent

`ui.js` talent cards + `talentModal`. Career stages derived from engine age/power/heat (RISING, BREAKOUT, PEAK, DECLINING, VETERAN, COMEBACK, RETIRED). Cards show role, skill, star power, popularity (heat), effective ask vs list fee, genre affinity, reputation (scandal/toxic/comeback/loyalty), availability, franchise links, last release, backend likelihood. Detail modal adds film history and a hiring read. Wizard picks gained one-line hire hints. Engine untouched.

## Franchise

`ui.js` empire cards + helpers (`frValue`, `frFanbase`, `frSequel`, `frSpinoff`, `frStreamVal`, `frTimeline`). Cards show value (catalog weights), fanbase estimate, heat, fatigue, merch/park status, sequel/spinoff/streaming potential, film count, earnings, weekly income, revenue history, and a text timeline (entries → live branches → next window). All action buttons and bindings preserved.

## Rivals

`ui.js` new rival profiles in Charts: strategy/strength/weakness per style, current dated slate, recent releases with gross, YTD + share rank. Behavior already existed in `engine.js` (corridor seeding, date chicken, competition share, poaching, sports bids, new streamers, trend-weighted openings); the upgrade surfaces it. No AI logic changed.

## Market

`ui.js` new market report in Develop: hot/weak/emerging summary, seasonal corridor note, and per-genre cards (heat, quarterly delta from `trendHist`, 52-week results, rival competition next 12 weeks, opportunity label). Read-only; trend simulation untouched.

## Finance

`ui.js` finance view: hero now cash/revenue/expenses/profit (trailing)/debt/interest-rate; ACTUAL revenue and expense splits by bucket; COMMITTED obligations (production remaining, marketing due, debt stack, run-rates, headroom); PROJECTED 12-week bars plus the previously unused detailed `forecastCard`. `PL_LABELS` extended for music/video/cofinance/other. No formula changed.

## Progression

`ui.js` `studioLevel` + `progressionCard` on Studio tab: 5 display-only levels (Indie → Growing → Major → Global → Entertainment Empire) mapped to existing milestones, unlock checklist (greenlight, hit, franchise, streamer, IPO, awards, $1B), rep-gate hints (40/60), and a legacy card. No new gates; saves unaffected.

## Mobile

`style.css`: overflow guards (`overflow-x: clip`, `minmax(0,1fr)` grids), wrapping sliders/cost-lines, chart-bar track fixes, 2-column stat hero ≤400px, full-row topbar actions on tiny screens, 44px modal actions, safe-area modal padding, wider desktop max-width. Verified live at 390px: no horizontal overflow, bottom nav active, layout usable. Other widths (320/375/430/768/1024/1280/1440) were not live-tested.

## Accessibility

`index.html`: skip link, nav labels, icon-button labels, labeled studio input, live-region toasts, labeled main landmark. `style.css`: `:focus-visible` outline, brighter secondary text, 44px modal close, extended reduced-motion coverage. Not done: modal focus trap / Escape handling (needs JS, deferred).

## Performance

`engine.js` `forecastProject` hoists `catalogValue()` out of the 12-row loop (12 O(films) passes → 1). `ui.js` finance hoists `maxDebt()` to one call per render. `saveGame` already serialized once. No benchmarks were run; gains are structural, largest on big libraries. No tracking or remote calls added.

## Testing

Extended, not executed (no shell available, so `node test/smoke.js` and `node test/ui-test.mjs` were not run):
- `test/smoke.js`: export/import round-trip + garbage rejection, 5-year inflation/wage drift, piracy/union finiteness, forecast finiteness, forced-insolvency game-over.
- `test/ui-test.mjs`: fixed hardcoded `/home/user/Box-office-War` ROOT to file-relative path.

## QA

Live browser (Browser Control harness, `file://`):
- New game found (QA Pictures, $130M, Y1 Jan W1), help modal, dashboard screenshot.
- Develop: 6 ideas, 15 trend rows, market report, writers market.
- Wizard end-to-end: writer/director/2 cast/producer attached, budget panel ($177M breakeven), greenlight → phase pre.
- Fast-forward to ready (W23), dated release, theatrical run ($45.9M opening, W53).
- Charts (WHY/mult/legs/rivals), Finance (actual/committed/projected), Empire empty-state, OTT platforms, talent stages, wrap-deal purchase ($20M → 3 pictures), achievements modal, talent profile modal.
- Save/export/import round-trip OK (43KB code, name restored).
- 390px: no overflow, bottom nav, 2-col stats, screenshot inspected.
- 30× ×4 advance to W142: cash finite, ledger finite, no game over, no page errors.
- Title fix verified: 0/200 "The The" titles after fix.
- Console: zero page errors throughout; only benign `file://` manifest CORS pair (real servers unaffected).

## Files Changed

- `BASELINE.md` (new): pre-change architecture/mechanics/debt survey.
- `ui.js`: dashboard, film flow, box office, talent, franchise, rivals, market, finance, progression, finance perf hoist, wrap-deal binding.
- `style.css`: responsive hardening, a11y (focus, contrast, motion, targets).
- `index.html`: skip link, ARIA labels, live-region toasts.
- `engine.js`: forecast catalog hoist; title-prefix fix.
- `test/smoke.js`: new coverage asserts. `test/ui-test.mjs`: portable ROOT.
- `UPGRADE-REPORT.md` (new): this file.

## Bugs Fixed

- Dead "Sign wrap deal" button (rendered, never wired): now spends $20M for 3 pictures of −20% fees, matching engine consumption.
- Title generator emitting "The The …": prefix now suppressed when the base starts with "The".
- `test/ui-test.mjs` unrunnable outside one machine: ROOT is now file-relative.

## Known Limitations

- Automated suite extended but never executed here; run `node test/smoke.js` and `node test/ui-test.mjs` (needs `jsdom`) before release.
- Only 390px mobile width live-tested; other breakpoints reviewed in CSS only.
- Scenario coverage (blockbuster/flop/debt/spree/franchise/streamer runs) not played out; systems exercised were single-film + idle-studio drift.
- Modal focus trap/Escape, keyboard-only walkthrough, and screen-reader pass not done.
- No performance measurements taken; improvements are structural.
- `docs/GAME-UPGRADE-PLAN.md` was never present; task prompts served as spec.

## Future Improvements

Run the suite; play the six scenario arcs; add modal focus management; complete breakpoint screenshots; measure render/forecast costs on large saves; consider `Intl` currency formatting and a save-slot repair tool.

## Integration (24 systems, verified live)

- No duplicate function definitions; no new top-level state without lazy init; all new save keys (`universes`, `spec`, `econ`, `tech`, `hq`, `repHist`, `eventHist`, `sportsDeals`, `endgame`, `econHist`) round-trip through export/import with zero validator errors.
- Bonus stacking audited: maxed-out tentpole opens at 1.26× base — no multiplicative blowup. Theater index applies symmetrically to player and rivals.
- Pre-existing duplicate noted, untouched: `G.mezz` vs `studio.mezzDebt` (two mezzanine tracks).
- Root-caused live: `||` precedence in the game-over Awards line swallowed the modal tail (pre-existing breakage of the game-over button); parenthesized and verified.
- Root-caused live: dropped brace in `upsertFranchise` killed `engine.js` at boot; restored and boot-verified.
- All 9 Studio boards, Empire (merch/universe/endgame), Finance (HQ/tech), OTT (market/series/sports), Develop (pitch/market), Charts (why/regions/demos/social/rivals) render together with zero page errors.
- 390px: no overflow on Studio/Finance. 20-year idle run: 398ms, finite money, valid save.
- Automated suite (`test/smoke.js`, `test/ui-test.mjs`) extended across passes but never executed here — no shell. `test/ui-test.mjs` hardcodes no paths anymore; `test/smoke.js` covers export/import, drift, forecasts, game-over.

## Status

STABLE — NOT RELEASE CERTIFIED. Live browser evidence throughout; automated suite still unrun.

# Release Candidate Hardening

- Clean launch: `data.js`, `engine.js`, `i18n.js`, `ui.js` all parse; manifest linked (file:// CORS block is benign); SW correctly skipped on `file://`; zero runtime network dependencies (only SVG namespace + SW passthrough in source).
- Full journey live: new game → pitch (6 buttons) → approve → writer/director/cast/producer → greenlight → production → screening (7 rows, 5 choices) → dating + viral campaign → theatrical ($23M opening) → charts → finance → continue-after-reload with run intact.
- 24 systems: each triggered live across passes (pitch approve/reject/save; screening all 5 choices; 8 campaign channels + presets; calendar move W7→W31; 5-genre regional splits exact; demo ×1.5 matched; awards noms + year wrap; 6 contract types incl. settlement; auction stoke + sale; series cancel/spinoff/ratings; buzz news ×4; HQ purchase + upkeep; merch profit + flop loss; cricket bid/win; 9 celeb events merged; review categories; 9 techs incl. completion; identity/perks; legacy grade/hall/heirloom; 10 spec paths; 11-year econ bounds; universe + 4/6 endgame; timeline/state).
- Save/load: fresh, populated, post-release, post-franchise, post-streaming, year-rollover, reload-continue, export/import all pass; validator clean. Malformed/missing saves return null without crash.
- Regression found + fixed: `importCode` skipped `validateSave`, accepting type-corrupt saves (e.g. cash as string) into the live economy. Now validated pre-migration; corrupt rejected, good codes still import.
- Long runs: 20-year idle sim clean (finite money, valid save, 398ms total sim time); rivals correctly zero at a year boundary.
- Console: zero page errors across the whole flow; only benign file:// manifest CORS.
- Mobile: 320/375/390/430 no overflow with bottom nav; 768 clean with tabs. Dialogs fit; touch targets ≥32–44px.
- Performance: render ~4ms, save ~1ms (44KB), ~1300 DOM nodes on richest tab; 1100+ weeks simulate in <0.5s. No timer leaks (single 1100ms auto interval, cleared on toggle).
- Robustness: XSS studio name escaped, no execution. Transient mid-week negative cash is pre-existing design (swept to debt weekly), not a defect.
- Remaining risks: automated suite unrun (no shell); 6 scenario arcs unplayed; keyboard-only/SR pass, focus trap, and non-390 breakpoints not live-tested; old-version (v1–v4) save migration exercised only synthetically in-test, not live.

Final certification status: STABLE — NOT RELEASE CERTIFIED. Blocked on the automated suite (`node test/smoke.js`, `node test/ui-test.mjs`) and scenario-arc playthroughs.

# FINAL RELEASE CERTIFICATION AUDIT

Date: 2026-09-19. Browser: Chromium via Browser Control harness, `file://`, 1600×900 + 320/375/390/430/768px. No shell/node in this environment — the committed node suite could not be executed; equivalent assertions ran live in-page instead.

- Core journey: new game → pitch → wizard → greenlight → production → screening (as-is) → dating + viral campaign → theatrical ($23M) → charts → reload-continue intact. No broken transition, no dead end.
- 24 systems: every system triggered live with state-changing, connected, saveable effects (see hardening + feature receipts). No disconnected mini-game found; cross-links verified (campaigns→opening/legs, demos→buzz, regions sum to intl, contracts→fees/payouts, tech/HQ→burns/craft, specs/rep→openings, econ→all对称).
- Save/load: byte-identical reload equality; populated saves keep contracts/spec/tech/econ/universes; validator clean; v1→v5 synthetic migration reaches v5 with zero errors; missing/malformed/import-garbage all return null/false safely.
- Import validation: re-confirmed (corrupt rejected, good imports).
- Long runs: 5-year played sim (37 films, 8 franchises, 7 awards, no bad values, save clean, 287ms); 11-year econ run (all indices bounded, infl +21.9%, wages +35%, history kept); 20-year idle (finite, valid save, 398ms).
- Console: zero page errors across all flows; only benign file:// manifest CORS.
- Mobile: 320/375/390/430/768 no overflow; bottom nav ≤760px, tabs above; dialogs fit; touch targets verified by style + live taps.
- Performance: render ~4ms, save ~1ms/44KB, ~1300 nodes richest tab, single auto interval. No leaks observed.
- Robustness: XSS name escaped; transient mid-week negative cash is pre-existing design (swept weekly).
- Regressions re-confirmed: import validation, game-over modal, boot brace — all green. New find this audit: `cashflowForecast` used removed `loc.rate` (v5 locations carry `rebate`), producing NaN week-detail nets — fixed one-word, retested finite live and in Finance UI.

Remaining blockers: (1) `node test/smoke.js` + `node test/ui-test.mjs` never executed — needs an environment with shell/node (jsdom for the latter); (2) six scenario arcs unplayed; (3) keyboard-only/screen-reader pass and focus trap outstanding.

Final certification status: STABLE — NOT RELEASE CERTIFIED.

# CERTIFICATION BLOCKER EXTRACTION

## Item 1 — BLOCKER: committed automated suite never executed

- Issue: `node test/smoke.js` and `node test/ui-test.mjs` (needs `jsdom`) have zero runs in any session; this environment provides no shell, so they cannot run here.
- Evidence: every prior report section states "Suite not run"; no log, transcript, or exit code exists in the repo.
- Affected: the release gate itself (regression safety net), not gameplay — every assertion both files contain (economy invariants, trends, reviews, talent aging, fatigue, streamer/subs, save stamp/migration/corrupt rejection, export/import, forecasts, game-over, full click flows) was verified live in-browser, several with higher fidelity than jsdom.
- Reproducibility: deterministic — run the two commands in any env with node (+jsdom); `test/ui-test.mjs` ROOT is now file-relative so it runs from any checkout path.
- Required action: one shell session with both commands; paste outputs into this report. No code changes expected.

## Item 2 — EVIDENCE GAP: six scenario arcs unplayed end-to-end

- Issue: blockbuster / flop / debt-heavy / rapid-expansion / franchise / streamer careers were exercised only as fabricated states, idle drift, and a 5-year mini-AI run — never as continuous played arcs.
- Evidence: each system's mechanics verified firing live; 5-year played sim (37 films, 8 franchises, 7 awards) and 20-year idle sim clean. No defect observed; only arc-level pacing/balance unobserved.
- Required action: play or script-play the six arcs; record outcomes.

## Item 3 — NON-BLOCKING: keyboard/SR pass and modal focus trap outstanding

- Issue: no keyboard-only walkthrough, screen-reader pass, or focus-trap/Escape handling (deferred during a11y pass).
- Evidence: all actions are native buttons/inputs with labels, focus-visible outlines, live-region toasts, and reduced-motion support — verified in markup and CSS. Nothing indicates breakage, but pointer-free traversal was never performed.
- Required action: none for release; fast-follow accessibility work.

## Defect check

Zero open defects. All four found regressions (boot brace, game-over `||` tail-swallowing, import validation, forecast `loc.rate` NaN) were root-caused, minimally fixed, and retested live with no collateral damage across subsequent full-journey and 20-year runs.

STABLE — NOT RELEASE CERTIFIED

# FINAL CERTIFICATION RESOLUTION

- Previous blocker (suite unrun): no shell/node exists in this environment (toolset verified: no `bash`, no runner; only browser control). Could not be resolved here. Every assertion in both suite files was instead verified live in a real browser at equal or higher fidelity (real clicks, real rendering, real localStorage). The two commands remain for one shell session; no code changes expected.
- Reproduction/root cause/fix/retest: not applicable — no defect, environmental limitation. Nothing forced.
- Previous evidence gap (six arcs): closed live via scripted play, ~160 weeks each: blockbuster $3.2B WW + franchise, alive; cheap-indie run alive and modest; debt spiral bankrupt W40; overproduction spree bankrupt W149; franchise run 21 films / 3 franchises / 13 hits; streamer 2.5M→3.0M subs, $148M revenue. Zero bad values; fail paths punish correctly.
- Regression check: arcs touched economy/production/release/franchise/streamer paths; subsequent state valid, console clean, no new defects.
- Non-blocking item (keyboard/SR/focus trap): untouched, remains fast-follow.
- Previous certification evidence re-verified valid: journey, saves (byte-identical reload), import rejection, migration, console, mobile, perf.

Final certification decision: suite execution still outstanding — one shell session away.

STABLE — NOT RELEASE CERTIFIED
