# Box Office War — Master Spec Audit (Sept 2026)

Audit of the game against `Box-Office-War-Master-Spec.md` (96 sections).
Status: ✅ implemented · 🟡 partial · ❌ not yet. Ships as v12.

## Shipped (v6–v9, before this audit)

| Spec § | Area | Status |
|---|---|---|
| 1.1 | Mobile rules: 44px targets, no h-scroll, bottom nav, bottom-sheet modals, no vertical text-wrap | ✅ (v7–v8) |
| 2 | Cinematic HUD styling, CSS-first motion, reduced-motion | ✅ (v7) |
| 5 | Global HUD chips | 🟡 chips exist; tap-through added in v10 |
| 6 | Floating Next Week FAB | ✅ (v8) |
| 7 | Control room: warnings, deadlines, ops, market, rivals cards | ✅ (ops card, v4) |
| 10 | Film cards show budget/marketing/WW/profit inline | ✅ |
| 13 | Break-even centralized (`breakevenWW`), shown everywhere | ✅ |
| 19/§31 | Audience split (critic/aud), cast chemistry | ✅ (v9) |
| 20 | Marketing builder: campaign boosts + channels + dashboard w/ ROI | ✅ (v5) |
| 23 | Pre-sales (advance money) | ✅ |
| 24 | Legs/WOM from quality & season | ✅ |
| 25 | International markets + multi-country targeting | ✅ (v8/v9) |
| 28–31 | Talent: age/power/skill/fee/heat/scandal/career, training, chemistry, multi-picture deals, walk of fame | ✅ (v4/v9) |
| 32 | Concert films/true-crime/music genres, soundtrack bonus | 🟡 genres exist; no music-label division |
| 33 | IP market (buy IP → ideas) | ✅ (v3) |
| 34–36 | Franchises: sequels, spinoffs, timeline fatigue, crossover warnings | ✅ (v4/v5) |
| 37–38 | Franchise fatigue meters + re-release/reboot/revival actions | ✅ |
| 39 | Awards: festivals, precursors, FYC, Golden Reels, snubs | ✅ (v5) |
| 40 | Industry news from real state | ✅ |
| 41 | Rivals: slates, poaching, play-chicken, streamers, M&A victims | ✅ |
| 43 | M&A desk: libraries, mini-streamers, rival slate firesale + acquired media actions | ✅ (v7) |
| 45 | Board pass on pitches | 🟡 pitch rejection only |
| 46 | Executives: hire, salary, effects | ✅ (v2) |
| 48 | Studio lot: HQ wings | ✅ (v5) |
| 49 | Technology tree | ✅ (v5) |
| 51 | Finance dashboard, loans, mezzanine | ✅ |
| 52–53 | IPO, stock price + sparkline, earnings calls, secondary offering | ✅ (v4) |
| 54 | Studio DNA / reputation identities | ✅ (v5 rep board) |
| 55 | Crises: strikes, piracy, theater caps, deepfakes, streaming wars, censor | ✅ |
| 57 | Achievements (proto Hall of Fame) | 🟡 |
| 58 | Legacy endgame board | ✅ (v5 endgame) |
| 61 | Weekly report: cash delta, releases, news, ⚠warnings, tab jumps | ✅ (v8/v9) |
| 62 | Notification priority: decisions interrupt, info stays toasts | ✅ |
| 63–66 | Error tolerance, save schema + migrations + validator | ✅ |
| 71 | Bounded, logged randomness | ✅ |
| 76–78 | Mobile film/talent/box-office cards | ✅ (v7/v8) |
| 81 | Reduced motion, focus states, aria labels | ✅ |
| 87–88 | Feedback copy, upfront cost visibility (decision cards) | ✅ |

## New in v10 (this release — Phase 1 mobile foundation)

| Spec § | Area | Status |
|---|---|---|
| 3 | 5-tab mobile bottom nav (Studio / Create / Films / Market / More) + More sheet for OTT/Empire/Finance/Settings | ✅ |
| 5 | Tap cash chip → finance drawer (burn, runway, credit); tap date → release calendar | ✅ |

## New in v12 (this release — Phase 3 box office depth)

| Spec § | Area | Status |
|---|---|---|
| 11–12 | Opening-weekend Fri/Sat/Sun daily split; per-week screens / occupancy / per-screen averages; week-over-week % rows | ✅ |
| 22 | Five named theater chains with booking relations, a court action, and screens + opening effects | ✅ |
| 23 | Advance-ticket curve: weekly accrual on dated films, schedule-modal projection, opening lift (≤ +6%) | ✅ |
| 26 | City-level box office under the top three release regions | ✅ |
| 27 | Dubbing/localization line item: charged at release, visible upfront in the schedule modal | ✅ |

## Remaining roadmap (ordered by the spec's phases)

**Phase 2 — Distribution ✅ (shipped in v11)**
- ✅ §8: pitch wizard now carries the explicit distribution step (own-streamer / external / hybrid); the wizard remains ~6 steps inline rather than a strict 7-step wizard.
- ✅ §9/§14/§16: own-streamer as a first-class release path — direct-to-streamer premieres, hybrid theatrical→own-streamer windows, own-streamer series (v11).
- 🟡 §15: streamer sub-tabs (Home/Originals/Library/Finance/Sports/Deals).

**Phase 3 — Box office depth ✅ (this release — v12)**
- ✅ §11–12: weekend daily breakdown (Fri/Sat/Sun by genre temper + audience WOM), screens/occupancy/per-screen averages, week-over-week % rows — engine `weekendDaily`/`screensOf`/`screenWeeks`, surfaced on live-run cards.
- ✅ §22/§23: five named theater chains with booking relations (court action, screens + opening effect) + the advance-ticket curve (`tickAdvances` weekly accrual, schedule-modal projection, opening lift ≤ +6%).
- ✅ §26/§27: city-level box office for the top three release regions (`cityRows` in the intl panel); dubbing/localization line item charged at release and visible upfront in the schedule modal.

**Phase 4 — Living industry (next)**
- ❌ §17: trailer/release campaign sequence with reception events (partially covered by MKT_BOOSTS).
- ❌ §18: fictional social platforms with trending hashtags driven by state.
- ❌ §21: celebrity promo obligations in contracts.
- ❌ §29: agent negotiation (flat fee → fee+backend packages) — partial via backend points.
- ❌ §42: deeper espionage events. §44–45: board votes. §46: executive careers. §47: staff skill trees. §50: legal disputes.

**Phase 5–6 — Empire & legacy**
- ❌ §32: music label division. §56: what-if sandbox (needs a state fork). §59: async scaffolding (seeds/leaderboards later).
- 🟡 §57: full Hall of Fame screen (records exist in state; needs a dedicated view).

**Always-on (spec §83–86)**
- 🟡 §83: incremental modularization of engine.js/ui.js as systems are touched (each new system gets its own section + single-source helpers; no big-bang rewrite).
- ✅ §84–85: engine owns every financial formula; UI renders.
- ✅ §86: balance tradeoffs (marketing diminishing returns, contracts, feuds).
- ✅ §89–91: clean error copy, no internal leakage in gameplay UI.
