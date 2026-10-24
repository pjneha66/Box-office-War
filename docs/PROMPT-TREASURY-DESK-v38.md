# TREASURY DESK rebuild + Finance sub-tab bug audit (v38.0)

Task: *"need an update and redesign in finance tab — find all bugs and old elements inside
subtabs and fix them. Add more features also."*

Delivered as **v38.0 Treasury Desk**, following the same pattern as v35 Empire Desk,
v36 Library Desk and v37 Game Studio Desk: a pure data layer in its own file, a
`command-*` shell in `ui.js`, scoped CSS in `command-deck.css`, one persisted lane nav,
and a dedicated offline regression suite.

20 files changed, 2858 insertions(+), 413 deletions(-).
New: `finance-desk.js` (707 lines), `test/finance-desk.mjs` (784 lines).

---

## 0. Facts verified in the tree (before changes)

- `viewFinance()` was one ~300-line scroll with a fake five-pill subnav. The first pill
  ran `window.scrollTo(0,0)` and carried a permanent `.active` class.
- `ipoModal()` and `maModal()` were **called but defined nowhere** — two live
  `Uncaught [ReferenceError]`s, reproduced in jsdom before any edit.
- Finance was the only tab absent from `TAB_META` / `TAB_SUB_ACTIVE` / `TAB_SUB_ATTR` /
  `TAB_SUB_DEFAULT` in `v31-features.js`, so `#subTabs` rendered `display:none` with
  zero children.
- Finance was also the only tab **missing from the Kairo-banner exclusion list**
  (`ui.js:1232`), so it got a second header above its own.
- `SUBTAB_PIXEL_ICONS` still carried five unused `finance:*` keys.
- `renderFinanceBanner()` hardcoded `profitMargin = 34.8` and the literal string
  `AAA Investment`, and rendered three buttons with no handlers.

## 1. Working rules followed

- **One source of truth per number.** The desk never recomputes an engine figure. It calls
  `interestRate()`, `weeklyOverhead()`, `maxDebt()`, `catalogValue()`, `marketCap()`,
  `cashflowForecast()` and `getStudioCreditRating()` through name-based lookups, so the
  screen and the weekly tick cannot disagree.
- **No control may look dead.** Every refusal beeps *and* toasts with the real reason.
  An unaffordable buy stays enabled — a `disabled` button never fires a click, so it can
  never explain itself.
- **No fabricated data.** Nothing renders a rating, margin, runway or forecast assumption
  that is not computed from live state this frame.
- **Money must reconcile.** The on-screen split is checked against the weekly ledger and
  any gap is printed as a visible warning, not swallowed.
- **Scoped CSS only.** Everything is namespaced under
  `#app #view[data-screen="finance"] .command-finance`; no legacy class is restyled
  globally and no hex literal appears in rendered markup.

## 2. Part A — bugs fixed

Each has a named regression in `test/finance-desk.mjs`.

### Rendering and navigation

| # | Bug | Fix | Test |
|---|---|---|---|
| 1 | `ipoModal()` / `maModal()` undefined → 2 × `ReferenceError` | Dead pills removed; lanes use `data-finsub` | A1 |
| 2 | First subnav pill fake (`scrollTo`, permanently `.active`) | One persisted lane nav over eight lanes | A2 |
| 10 | Finance absent from `TAB_META` / `TAB_SUB_*` → `#subTabs` empty and hidden | Registered, reading `FinanceDesk.SECTIONS` with a static fallback | A3 |
| 15 | Hardcoded `#0d1119` / `#0a0e16` / `#ffdf9a` broke light mode | 253 lines of scoped `--fin-*` token CSS | A10 |
| 16 | Executives and purchasables rendered twice (once via `hqBoard()`) | Execs only on Board; upgrades/HQ only on Invest | A18 |
| 20 | APK bundle missing `bo-charts.js` and `gamestudio-desk.js` | Added to `apk/build-www.js` FILES | packaging |
| 28 | `$$("[data-seq]")` bound **twice** in `bindView()` | Merged into one handler | A21 |

**#28 in detail.** `data-seq` is emitted by two features with different id spaces: film
sequels (Produce franchise cards, Library films) and series seasons (Live/OTT
"New season", Library series). Both bindings were global, so the second — film-only —
overwrote the first. Every "New season" button looked its series id up in `G.films`,
found nothing, and silently did nothing. One handler now resolves films, then series,
then explains itself for an unknown id and for a cancelled series.

### Ledger maths

| # | Bug | Fix | Test |
|---|---|---|---|
| 3 | `finTrail()` double-counted and mis-neted | Per-category sign split | F1–F5 |
| 4 | `exp.other` computed but never rendered | Rendered | F6 |
| 5 | 10 real categories absent from `PL_LABELS` / `finTrail()` | `CATEGORIES` covers all 39 | F4, F11 |
| 6 | Interest hardcoded `debt*0.0018` vs `interestRate()` on one screen | Single `_engine("interestRate")` | A6 |
| 7 | `plCard()` read `G.txHistory.length` unguarded → `TypeError` killed the whole view on legacy saves | `(G&&G.txHistory)||[]` | A7 |
| 9 | Dead code `if(s.phase==="shoot") mktDue+=0` | Every unfinished phase now burns cash | F2 |
| 12 | `tickBondsWeekly()` mutated `S.studio.cash` directly — coupons invisible to `weekTx`, `finTrail()`, search and the earnings call | Routed through `spend("interest")` / `spend("financing")` | F10, A11 |
| 21 | **Eight more unmapped categories**: `linearTv`, `boxoffice`, `merch`, `game_revenue`, `game_sales`, `guild_dues`, `anti_piracy`, `financing` | All mapped | F11 |
| 22 | **Bucket routing was not side-safe** | `_bucketFor()` | F11 |

**#3 in detail.** With `{theatrical:100, music:-5, other:10, studio:-50, empire:30}` the
old code reported `R:135, E:20, P:115` against a true profit of `85`: `empire` landed in
both `rev.merch` and `exp.studio`, `other` in both sides, and mixed-sign categories were
netted through `Math.max/min(0, Σ)` so a −5 music cost cancelled +5 of other income.

**#21 and #22 in detail — the worst defect found.** A second census of every
`earn("…")` / `spend("…")` call in the repo found 39 categories, eight of which were still
unmapped. `unknownCategory()` deliberately names an *expense* bucket, and `_rollBuckets()`
wrote the positive side to `rev["otherexp"]` — a key that is not in `BUCKET_ORDER_REV` and
therefore never summed into `R`. **A $12M linear-TV week vanished from profit entirely.**
This was caught not by inspection but by the reconciliation assertion failing in
`ui-test.mjs` with `reported:-8.7, ledgerNet:3.3, delta:-12`.

Both layers are fixed: the categories are mapped, and `_bucketFor()` now refuses to route
an amount to a bucket on the wrong side, falling back to that side's catch-all so money can
never leave the P&L again. `F11` asserts the census is complete *and* that a deliberately
unknown category reconciles in both directions.

### Forecast, ratios and capital

| # | Bug | Fix | Test |
|---|---|---|---|
| 8 | Silent dead controls (`takeLoan(10)` false with no `else`; `#fnRepay` max `Math.max(1,…)`) | Every refusal beeps + toasts | A8, A9 |
| 11 | `forecastProject()` contradicted `cashflowForecast()` on one screen; card `title` invented "8.5% cost of capital, catalog decay −1.5%/quarter, facility lease renewal week 52" | One forecast; tooltip states real assumptions | A17 |
| 13 | Banner fabricated `AAA Investment` / `+34.8% RoIC` for a near-bankrupt studio; 3 dead buttons | Live grade and margin; real handlers | A5, A12 |
| 14 | `finance-tools.js`: EBITDA subtracted interest, `interestCoverage` always `Infinity`, `currentRatio` div-by-zero on `st.overhead` | `Math.abs()`, `null` not `Infinity`, `weeklyOverhead()`, 0.05 floor | A13 |
| 17 | `#fnMezz` hardcoded `max=200` while `mezzanineLoan()` had **no cap at all** | Real tranche, engine-enforced | F12, A20 |
| 18 | Raw string interpolation instead of `fmtM` | `fmtM` throughout | — |
| 19 | Silent `catch(e){}` hid board / forecast / HQ / lab sections | Unmapped categories and reconcile gaps now surface as warnings | F11 |
| 23 | *(introduced and caught in review)* `buyUpgrade()` returns `undefined`, so testing its result reported every successful build as refused | Success read from `G.upgrades[id]` | A18 |
| 24 | Refusal handlers on `disabled` buttons were unreachable dead code | Buttons stay enabled; label carries the shortfall | A18 |
| 25 | `forecastProject()` was a second, cruder forecast | Delegates to `cashflowForecast()` | A17 |
| 26 | `cashflowForecast()` filtered `items` to `|amt|>=0.5` before exposing them, so the revenue/cost split could not be re-derived losslessly | Rows now carry exact `rev` / `cost` | A16 |
| 27 | Mezzanine success toast reported the amount *requested*, not the amount drawn after clamping | Reports the real delta | A20 |
| 29 | Empty-history copy read "Profitable on the trailing 0 weeks" | Honest empty state; telemetry shows `—` | B |
| 30 | `bow-motion.js` did not know the desk's class vocabulary, so Finance would have been the only screen with no grow-in motion | Selectors extended | — |

**#11 in detail.** `forecastProject()` computed overhead as
`st.overhead + projects*0.12 + series(shoot)*0.15`, while the weekly tick calls
`weeklyOverhead()` — which also bills executive salaries, headquarters upkeep, crew
retainers, the music label and the game division. The forecast was therefore
**systematically optimistic**, and it ignored `interestRate()` (so it missed the CFO's 30%
discount) and modelled theatrical decay itself instead of using `expectedOpening()`.
`A17` now asserts the two agree on all twelve nets.

**#17 in detail.** Mezzanine is subordinate emergency money at 0.5%/wk (≈26%/yr). The
tranche is now **half the senior facility** that `maxDebt()` already sizes from catalogue
value and committed production budgets — expensive-but-available for a real studio, out of
reach for one that cannot service it, and no longer an identical $200M for a $3M indie and
a major. `mezzCapTotal()` / `mezzCap()` live in the engine and are enforced inside
`mezzanineLoan()` (clamping like `takeLoan()`, refusing loudly when full), so the cap is
real and not merely a UI ceiling. The rule is stated on screen.

## 3. Part B — the desk surface

`FinanceDesk.SECTIONS` — eight lanes on one persisted nav (`G.finState.sub`):

| Lane | Contents |
|---|---|
| `ledger` | This week's live P&L, trailing split over a selectable 4/8/12-week window, per-category breakdown, text/direction/category filters, reconciliation banner, CSV export |
| `capital` | Credit facility, mezzanine tranche, corporate bonds, maturity ladder, covenant checks, weekly burn |
| `forecast` | 12-week cash-flow projection, runway, five-scenario stress test with a verdict |
| `equity` | Share price and sparkline, market cap, earnings calls, secondary offerings |
| `deals` | M&A offers, library acquisitions |
| `analysis` | Financial analysis lab — comps, key ratios, multi-currency |
| `board` | Board members, executives, approval |
| `invest` | Studio upgrades, headquarters wings, technology tree |

New capabilities that did not exist before: **maturity ladder**, **covenant checks**,
**runway in weeks**, a **five-scenario stress test** (`STRESS_PRESETS`) with a plain-English
verdict and insolvency week, **on-screen reconciliation** of the split against the ledger,
**ledger filtering and search**, and a **live credit rating** replacing the hardcoded `AAA`.

`finance-desk.js` exports `version, BUCKETS, BUCKET_ORDER_REV/EXP, CATEGORIES,
FINANCING_CAT, SECTIONS, LEDGER_RANGES, STRESS_PRESETS, ensure, subOf, categoryOf/Label,
categoriesPresent, ledgerTrail, ledgerWeek, ledgerSeries, ledgerRows, ledgerCommit,
balanceSheet, maturityLadder, runway, covenantChecks, creditRating, stressForecast,
attachEngine, engineFn, _internals`. State persists on `G.finState {sub,q,cat,side,weeks,stress}`.

Engine lookups are name-based (`_engine("interestRate", 0.0018)`) with `attachEngine(map)`
for Node, because top-level function declarations inside a CommonJS wrapper are
module-scoped rather than on `globalThis` — a `global.X` lookup silently falls back to the
hardcoded default under test while working fine in the browser.

## 4. Verification gates (all offline)

`test/finance-desk.mjs` — **F1–F12** (pure Node data layer, no DOM), **A1–A21** (jsdom),
plus desk-shell (**B**), lane-coverage (**C**) and a zero-runtime-error sweep across all
eight lanes. Wired into `npm run test:finance` and `npm run test:management`.

All green:

- `npm test` — smoke, ui-test, balance, 5 × 200-week scenario playthroughs, sandbox audit
  (52 weeks, 0 runtime errors) → `ALL SANDBOX CHECKS PASSED`
- `npm run test:management` — 13 desk suites including Treasury, Empire, OTT, Library,
  Live, Box Office, Cost Sheet
- `npm run test:gamestudio` — 209 passed, 0 failed
- `node test/lot-packaging.cjs` — offline manifest, web/APK file parity, art packaging

Existing tests updated rather than deleted, because the controls moved rather than
disappeared:

- `test/ui-test.mjs` — the IPO/stock, live P&L, loan-slider and executive-hire steps now
  switch lanes first; `.stock-spark` → `.finance-stock-spark`; the P&L step additionally
  asserts reconciliation. The slider step now checks the *closed* credit line explains
  itself instead of assuming a slider always exists.
- `test/empire-desk.mjs` — used `TAB='finance'` as the control proving the Kairo banner
  renders on non-excluded tabs. Finance is now excluded too, so the assertion is inverted
  and extended to check the banner no longer carries the `34.8` / `AAA Investment`
  fabrications.
- `test/library-desk.mjs`, `test/ott-desk.mjs` — release-plumbing gates moved to
  `38.0 / 53.0 / 52.0 / bow-v98`.

## 5. Release plumbing (moves as one versioned unit)

`index.html` meta `38.0`; `ui.js?v=53.0`, `engine.js?v=49.0`, `v31-features.js?v=48.0`,
`command-deck.css?v=52.0`, `bow-motion.js?v=35.0`, new `finance-desk.js?v=38.0`,
`finance-tools.js` / `bond-market.js` / `kairo-theme-suite.js` `?v=38.0`;
`sw.js` `bow-v98-cache` plus the new precache entry; `package.json` /
`package-lock.json` `38.0.0`; `version.json` `38.0`; `apk/build-www.js` FILES.
`NEXT_UPDATES` gained a shipped `38.0` entry.

## 6. Deliberately not changed / open items

- `SUBTAB_PIXEL_ICONS`' five unused `finance:*` keys were left in place. They are inert, and
  removing shared table entries risks other desks; worth a separate sweep across all tabs.
- `financeOverviewSheet()` (the cash-chip drawer) keeps its own compact summary. It reads
  the same helpers, so it cannot contradict the desk, but it is a second surface with its
  own markup.
- `catch(e){}` blocks remain around the analysis lab and board sections. Unmapped
  categories and reconciliation gaps now surface visibly, but a thrown error inside those
  two panels is still swallowed to keep the rest of the lane rendering.
- `bow-restyle.css` / `style.css` / `ui-v33.css` still carry `.stock-spark`,
  `.forecast-bars` and `.pl-bars` rules for other tabs. The desk uses its own
  `finance-*` vocabulary and does not inherit them; the legacy rules are untouched.
