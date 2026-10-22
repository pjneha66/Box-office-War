# Box Office War — implemented gameplay rebuild

**Visual follow-up:** see `ART-DIRECTION-PASS.md` for the subsequent CC0 Kenney
furniture/vegetation integration, header-layout fix and refreshed browser captures.

This report supersedes the earlier partial-pass report. The original application's
film, finance, talent, television, streaming, franchise and weekly-rule systems
remain in place. The changes rebuild their spatial presentation and interactions,
not replace Box Office War with a different game.

## Confirmed original defects

1. The campus was a painted image with independently moving decorative characters;
   the actual simulation grid/buildings appeared only while Build mode was open.
2. Build buttons only set a flag. The click handler could visit backdrop hotspots,
   but could not place a facility or select an employee/building.
3. JS routes were straight-line waypoints through footprints. `tick(0)` still moved
   time forward. The Rust implementation had a different path contract.
4. Synchronization retained completed productions and could spawn a release crowd
   repeatedly on UI renders. Layout/agents were absent from career saves.
5. Window input handlers accumulated on remount, drag release could also click,
   canvas backing pixels ignored DPR, and touch cancellation lacked ownership.
6. Multiple decorative RAF/observer owners, full-screen CSS grain/scanlines, animated
   UI chrome and blurred backdrop layers obscured the world and added raster work.
7. The lot Develop button called a nonexistent `developModal`. The APK command built
   `www/` but did not synchronize it into the native project before Gradle.

Further defects reproduced during this implementation: lot controls could scroll
under the sticky app toolbar; large actor hit areas could select occluded staff
through buildings; renderer remount could retain a DOM canvas without restarting
its context/loop; restoring buildings with ID gaps could overwrite a sibling; and
some available-looking mentorship actions could never satisfy the engine rules.
All have code fixes and relevant automated coverage.

## Implemented game systems

### Campus and management

- Campus draws the actual persisted buildings and actual simulated agents, with a
  shared camera projection, depth order, bounds and selection model.
- Mouse/touch pan, pinch/wheel zoom, sensible limits, keyboard pan/reset/cancel and
  in-page immersive Expand/Restore. Campus camera is retained across departments.
- Construction previews: collision/occupied-site/route/entrance validation, cash
  check, transaction accounting, feedback and cancellation. Touch uses a deliberate
  preview tap followed by a second confirming tap rather than an accidental purchase.
- Context inspectors show real project/phase/progress, real employee assignment,
  authoritative equipment tiers and prices. Equipment upgrades use the existing
  facility module, including its affordability and maximum-tier rules.
- Develop, Slate, Talent, Finance and Box Office open existing real management UI.
  Management pages are no longer stacked over an animated background scene.
- HUD: cash, debt, reputation, date and active production count. Flat, readable
  controls and a restrained Hollywood studio palette replace ornamental layers.

### Workers, interiors and animation

- Original art pipeline: **seven roles × seven states × four directions × four
  frames**, plus eight distinct isometric facility illustrations. Generator and
  metadata are committed; no game-reference art is copied. See `STUDIO-ART.md`.
- `StudioActors` is the shared atlas selector/drawer for campus and cutaways.
  States: idle, walk, work, interact, celebrate, react, rest. Walking is driven by
  distance, actions by elapsed state time; state changes reset timing.
- Roles (writer, editor, producer, director, camera operator, leading actor and
  audience) have writing/editing/producer/clapper/camera/acting/audience props and
  actions. A real project leaving a workplace triggers a finite celebration; invalid
  routes react. Reduced motion freezes optional gestures, not necessary movement.
- Writers, stages, editing suites, executive offices and cinemas are simulated
  cutaway rooms, not static scene paintings with random activity. They show the
  same selected building and employees as the campus. Staff enter through an
  accessible campus entrance, follow an indoor grid route around furniture and
  occupy assigned workstations. Indoor employees remain selectable.
- Actors mirror booked project talent, retained/multi-picture talent, hired BTL,
  executives and C-suite officers. Unhired public-directory talent is not spawned.
  Removing a contract/hire removes its spatial representative. Baseline operating
  crews are represented without inventing a second salary or hiring economy.
- Deterministic BFS on the bounded campus, occupied-cell avoidance, destination
  reservations, indoor entrance admission, waiting and replanning. Crowds attend
  a cinema for a bounded session before leaving the spatial scene. This does not
  award additional money or change film box-office results.

### Simulation clock, performance and saves

- One world RAF owner; neither actor nor room module advances simulation or owns
  a timer. Legacy lot effects retain their compatibility APIs but do not boot by
  default. Synthetic quality-point generators and unused room-presentation code
  were removed after checking dependencies.
- Shared pause/speed controls synchronize staff and existing auto-week timing.
  Auto-weeks stop for hidden tabs, pause and unresolved management decisions.
  Manual Next Week remains a deliberate single-step while paused.
- Elapsed deltas capped after suspension, acceleration/braking, distance-anchored
  walk frames, terrain cache invalidated by construction/demolition, decoded image
  reuse, explicit asset-error fallbacks, resize ownership and event disposal.
- Auto quality adapts pixel resolution when measured cadence is slow; Crisp uses
  up to DPR 2; Battery uses DPR 1 and a ~30 FPS draw cap. No mandatory external
  fonts/services. Full-screen grain, blur and purely ornamental CSS animation
  layers are disabled in active gameplay.
- Optional versioned `G.studioLot` preserves layout/IDs, agents, indoor positions,
  assignments, walkable routes, release deduplication and spatial ticket counters.
  Existing save keys/version and economic fields are unchanged. Old careers gain
  a starter lot; early spatial saves gain missing writer/editor operating roles.
- The JS spatial engine is canonical on web and Android. This deliberately avoids
  silent asynchronous switching to the legacy WASM implementation, which lacks
  the new indoor/reservation/save protocol. Legacy binaries/source remain intact
  and packaged, but are not advertised as feature-equivalent or enabled.

## Files and ownership

| File(s) | Reason |
|---|---|
| `studio-lot-engine.js` | Routing, crowd admission, indoor paths, animation states, staff reconciliation, production sync, clock, save bridge and restore validation. |
| `studio-lot-2d.js` | Single renderer/scheduler, terrain cache, camera/input, construction, inspectors, original artwork integration, quality and lifecycle diagnostics. Removed ~1,500 lines of superseded decorative routines from the first repair. |
| `studio-actors.js`, `studio-departments.js` | Shared atlas pipeline and live cutaway rendering, no independent loops or simulation mutations. |
| `scripts/build-studio-art.cjs`, `assets/studio/*` | Original reproducible facilities/actor sheets and atlas metadata (~96 KB total art). |
| `lot-gameplay.css`, `index.html` | Game-first layout/theme, touch targets, reduced motion, removal of overlay effects and external font requests; new module load order. |
| `lot-life.js`, `lot-feel.js`, `bow-motion.js` | Disable competing default presentation owners without deleting compatibility APIs. |
| `engine.js` | Snapshot optional lot data before the existing save serialization. No film/finance rule changes. |
| `ui.js` | Shared auto-week pause/speed, safe decision blocking, accurate mentor availability. |
| `sw.js` | Updated cache, complete new modules/art and locally referenced UI image precache. |
| `apk/build-www.js`, `package.json` | Include new root modules/CSS; APK command now runs Capacitor sync before Gradle; QA/art commands. |
| `test/lot-*.cjs` | Spatial/animation/save, browser interaction, rooms/upgrades/clock, mobile, offline, packaging and sustained-performance tests. |
| `test/ui-test.mjs` | Close JSDOM on success; choose a genuinely unmentored junior for the mentorship fixture (weekly events can already create mentorships). No gameplay assertions removed. |
| `test/sandbox-audit.mjs` | Move construction fixtures off protected entrances; no assertions removed. |
| `.gitignore`, documentation, screenshots | Ignore local QA output, document architecture/reproduction and retain actual visual evidence. |

## Verification ledger

Final aggregate `npm run test:all` passed, as did desktop/mobile/department/offline
browser checks and web/native asset staging parity. See `LOT-VERIFICATION.md` for
exact command results and measured performance. Browser
fixtures that insert project records are explicitly labelled controlled spatial
fixtures, not represented as UI-greenlit films; the original UI suite exercises
real script selection, talent attachment, greenlighting, production, release and
save/load. Physical Android validation and native compilation are separately
reported rather than inferred from browser emulation or web-asset packaging.

## Launch and manual acceptance

```sh
npm ci
python3 -m http.server 8080 --bind 0.0.0.0
```

Open `http://localhost:8080`, start/resume a career and choose **2D Lot**.

1. Select a visible facility body or employee. Inspect assignments and production.
2. Build Facility → choose a type → preview clear/blocked ground → confirm. On touch,
   tap a valid site twice. Done/Escape cancels without charging cash.
3. Use the equipment upgrade button to invoke the existing economic upgrade rules.
4. Develop → choose a script → attach talent → complete the existing wizard. Advance
   weeks to move from preparation to filming to editing, and schedule/release as before.
5. Return to the lot; visit Writers, Stage, Post, Cinema or Executive. Select indoor
   staff. Pan/zoom, switch departments and return without losing career state.
6. Pause/Resume, 1×/2×/4×, Auto/Crisp/Battery and Expand/Restore all invoke real actions.
7. Save/reload; repeat offline after the service worker is ready.

Android build prerequisites: JDK and Android SDK, plus access to Gradle/Maven hosts.
Install the pinned wrapper dependencies without the optional asset-generation dev
packages, then build:

```sh
npm ci --prefix apk --omit=dev
npm run apk
```

`npm run apk:web` builds only the web bundle. For a non-native validation:

```sh
npm run apk:web
cd apk && npx --no-install cap sync android && cd ..
npm run test:packaging
```

## Scope boundaries, not hidden functionality

Economic staffing remains the existing contract/project system. A destination
assignment changes where someone works; it does not secretly sign a contract or
charge another salary. Campus construction buys a persistent spatial facility;
equipment tiers/quality bonuses remain governed by the existing facility economy.
This preserves balance and existing career progression rather than adding an
untested second economy. Optional weather/night/shake effects are intentionally
not reintroduced. The legacy WASM binary is not the active spatial backend.
