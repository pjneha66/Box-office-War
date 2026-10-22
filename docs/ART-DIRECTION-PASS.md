# Asset-led visual pass — 22 October 2026

Follow-up to the user's feedback that the rebuilt lot did not feel premium.
This is an implemented art pass, not a claim that the earlier engineering rebuild
already met the visual bar.

## Sourcing

Reviewed the user's OpenGameAsset.net 2D catalog and a candidate isometric pack's
source page. That source page required browser verification and did not supply a
clear reusable license in the accessible content. No files from that candidate
were copied, and "free download" was not treated as proof of commercial rights.

Instead integrated **Kenney Furniture Kit 2.0** (17 selected source sprites) and
**Nature Kit 2.1** (two source sprites), both explicitly **CC0** in the included
original licenses. Retrieved from the ETdoFresh/kenney.nl GitHub mirror; original
creator and source links are documented in `assets/vendor/*/README.md`.
No login, premium membership, paid service or external runtime requests required.

## Actual visual changes

- Live writers/editing/executive rooms now use real isometric desks, desk chairs,
  monitors, keyboards, bookcases, books, plants, lamps, lounge seating and tables.
- Cinemas use upholstered seating. Original scene geometry and fallback furniture
  still render if the atlas fails; unavailable art emits a diagnostic warning.
- Wood plank floors, department-specific materials, paneled two-tone walls,
  brass-colored trim and a raised floor edge replace flat placeholder boxes.
- Original animated workers remain tied to the same production/route/assignment
  state. Workstation furniture is behind workers in depth order, not pasted over
  their heads; indoor selection and assignment still work.
- Campus has a raised foundation, restrained cached turf detail and real palm/bush
  sprites placed **outside** the playable grid. No invisible collision changes,
  new obstacles, fake employees, economy changes or save migrations.
- Desktop department tabs have readable labels rather than tiny unlabeled icons.
  Campus offset now measures the actual global header height, preventing overlap
  when a long studio name wraps the HUD. Header observers share existing cleanup.
  Rebalanced navy/teal/brass controls, compact redundant HUD fields, clearer primary
  actions, inspector hierarchy and removal of remaining HUD pseudo-decoration.
- No blur, glow, particles, screen shake, new timer or independent render loop.
  Furniture uses one local **640×512 atlas** rather than 17 per-frame image loads.

## Ownership and reproduction

- `studio-departments.js`: single cached furniture atlas; real room integration.
- `studio-lot-2d.js`: perimeter assets, raised campus and cached ground materials.
- `lot-gameplay.css`: navigation, HUD, inspector and action hierarchy.
- `assets/vendor/kenney-furniture/`: source PNGs, generated atlas/metadata, license.
- `assets/vendor/kenney-nature/`: original and trimmed sources, license.
- `scripts/build-furniture-atlas.cjs`: reproducible trim/resize/pad/atlas pipeline
  (`npm run art:furniture`, requires existing dev dependency sharp).
- `sw.js`, `index.html`: cache version v51, runtime art precache and cache busting.
- Browser/offline/packaging tests check atlas readiness and vendor assets/licenses.

Furniture frames are fixed 128×128 cells (five columns); runtime frame rectangles
match `atlas.json`. Source PNGs are unmodified. Nature derivatives are alpha-trimmed
and resized with sharp; widths are 112 (palm) and 72 (bush).

## Verification scope

Reran the 21 lot contracts, desktop (9), touch-emulated mobile (5), department (9),
offline and packaging checks. Refreshed `apk/www` and Capacitor native assets.
Completed 4×30-second software-rendered Chromium soak at 1280×800 DPR2:

| View | Measured FPS | p95 interval | Mean draw CPU |
|---|---:|---:|---:|
| campus | 60.00 | 16.7 ms | 0.361 ms |
| writers | 59.19 | 16.8 ms | 0.443 ms |
| soundstage | 59.92 | 16.7 ms | 0.354 ms |
| post | 59.86 | 16.7 ms | 0.339 ms |

Retained JS heap delta after forced GC: **217,448 bytes**. Zero page errors,
zero failed asset requests, one canvas. This art soak preceded the final HUD-spacing
and wrapped-header offset fix; the final desktop/mobile/department/offline checks
were rerun after those adjustments. This is not a physical-device benchmark.
The full management/economy aggregate passed in the preceding implementation turn;
it was not rerun for this presentation-only pass. No simulation rules were changed.
No native APK compilation or physical Android test is claimed.

Actual updated browser captures: `screenshots/lot-after.png`, `lot-writers.png`,
`lot-stage.png`, `lot-post.png`, `lot-mobile.png`. These are not asset preview images
or generated mockups; they capture the functioning game.

## Additional free assets requested by the user

A second web search confirmed the creator's Furniture Kit and Car Kit pages list
CC0 licensing. Added five further furniture renders (individual upholstered cinema
chair, coffee machine, coffee cabinet, open production crate and lounge chair),
plus a delivery vehicle and sports sedan from the mirrored Car Kit 1.4.
The furniture atlas now contains **22 sprites (640×640)**. Regenerating it also
updates the runtime frame rectangles automatically; packaging tests verify parity.

Added individual cinema seats, writers/executive coffee corners, stage equipment
monitor and production crates. Vehicles are parked on a connected exterior paved
annex, outside the build/navigation grid; they do not pretend to drive or affect
finances. Original licenses and source PNGs are retained. All runtime derivatives
are precached, included in APK/native staging and verified by the offline test.

Reran: lot contracts 21/21, desktop 9/9, mobile 5/5, departments 9/9, offline,
packaging, syntax checks and `git diff --check`. No economy or save changes.
