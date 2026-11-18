# Cast Directory: full catalog, sign-on, multiple pins (root web build)

## What changed
- **`cast-catalog.js` (new):** a deterministic catalog of 1,000 performers and crew
  (about 62% actors, 14% directors, 12% writers, 12% producers) built from the name banks.
  Nothing is saved for catalog entries; they regenerate from a fixed seed.
- **Sign-on:** a catalog entry joins your roster through `castSign(id)`. It copies the entry
  into `G.talent`, charges a signing fee of 50% of the performer's fee (minimum $0.2M), and
  logs it. A person can be signed once.
- **Cast Directory:** a source switch, "On your roster" (default) or "Full catalog · 1,000".
  Catalog rows show a Sign button. Search, role filters, and "Show 60 more" work on both sources.
- **Multiple pins:** each slot (next film, next series) holds up to four performers, not one.
  `G.castPins.film` and `G.castPins.series` are now arrays. Old single-id saves are migrated on read.
  A film pitch seeds up to four pinned performers as leads. Pitches and the series wizard
  list every pin. Unpinning a chip removes just that performer.

## What did not change
- Roster size, the talent market (about 34 people), booking rules, fees, and box-office
  logic are unchanged. Signed people are ordinary roster talent from then on.

## Tests
- `test/cast-catalog.mjs` (new, 15 checks): catalog size and uniqueness, signing cost and
  duplicate refusal, multi-pin cap and unpin, pitch seeding, and directory rendering.
- `test/develop-deck.mjs` and `test/develop-deck-browser.cjs`: updated for the array pin shape.
- Known, pre-existing: `develop-deck-browser.cjs` fails at its nav-radius check (`999px`
  vs the expected ≤6px). That check runs before the cast section, and this change has no CSS edits.
