# Box Office Collection — v43.0

The Collection Command desk (Box Office → Collection) adds player-driven levers that raise what each picture actually collects. Every lever is paid from studio cash, runs on a week timer, and pays back through the normal ledger — growth is earned, not free.

## The seams

The module wraps existing engine.js seams — it never duplicates opening/legs/decay math:

| Engine hook | What Collection adds |
|---|---|
| `expectedOpening()` | `BoxOfficeCollection.openingMultiplier(p, G)` — circuit screens, booking corridor, discount Tuesday lift the opening (capped at +32%) |
| `legsOf()` | `BoxOfficeCollection.legsBonus(f)` — active levers extend the tail (+0–45%) |
| `tickTheatrical()` | `BoxOfficeCollection.tick(G)` — pays lever uplift, merch windows, finished-run library levy into `earn("theatrical"\|"merch"\|"library")` |

## Lever reference

| Lever | Icon | Cost | What it does | Gate |
|---|---|---|---|---|
| Screen Expansion Push | 🖥 | ~7% of marketing | +12–26% weekly gross per level | Not on platform pattern |
| Event Pricing | 🎟 | ~5% of marketing | +8–20% weekly gross per level | Premium/IMAX or action/scifi/fantasy/animation |
| International Blitz | 🌍 | ~6% of marketing | +10–22% weekly gross per level | International rollout already reporting |
| Merch & Tie-In Window | 🧢 | ~3% of marketing | Converts heat to merch revenue | Not horror/drama/war |
| Re-Release / Restoration | 🔁 | ~5% of marketing | +55–70% on re-open | Run must be closed |
| Circuit Screens | 🖥 | $34+ per tranche | +2.2% on every wide release | Max 10 tranches |
| Booking Corridor | 🗓 | $45 | +5% to every live run | 26-week cooldown |
| Discount Tuesday | 🎟 | $2 | +8% admissions | Toggle |

## The valve

A global ceiling limits how much extra spend the market pays out per week:

`valve = clamp(base + per_opening × sum(live openings), share_base, share_cap) × corridor_factor`

If requested uplift exceeds the valve, the excess is **damped** (refused, not banked) and shown in the coffer ledger. This prevents runaway compounding.

## Save compatibility

All Collection state is optional and lazy-initialised:

- `G.collection` — career-level valves, screens, corridor, weekly history
- `f.collection` — per-film lever clocks, cost, totals

A pre-v43 save with no Collection fields plays identically until the player opens the desk.

## Configuration

All numbers live in one `CONFIG` block at the top of `box-office-collection-engine.js` — tune strengths, costs, weeks, and the valve there.

## Tests

`test/collection-engine.mjs` — 25 checks: A/B lifecycle (same snapshot, same seed), valve ceiling, lever clocks, eligibility gates, save round-trip, legacy save compatibility, desk render. Run with `npm run test:collection`.
