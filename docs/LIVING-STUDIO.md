# Living studio simulation

> Latest seating and department-room corrections: [ROOM-DESIGN-PASS.md](ROOM-DESIGN-PASS.md).

> Subsequent character-art update: [PEOPLE-ART-PASS.md](PEOPLE-ART-PASS.md) supersedes the character-art description, crew count and performance samples below. This document records the earlier simulation implementation.

## Architecture and actual rules

- `studio-agent-life.js` is the DOM/timer-free task controller. Agents retain identity, appearance, department, needs, mood, motivation, source talent skills, relationships, a finite task, cooldowns, navigation failures and up to 16 reasoned transition entries. Event diagnostics are bounded to 40 entries. Saved version-1 agent life records are optional additions to existing spatial saves; absent records initialize without deleting a career.
- `studio-lot-engine.js` remains the movement authority. One 30 Hz fixed-step accumulator, bounded incoming deltas, previous-position snapshots, acceleration/turns, occupancy checks, workstation/entrance reservations and failed-route retries drive everybody. Department changes physically exit before campus reassignment. Indoor and campus coordinates are independent of camera pan/zoom. Cinema exit reservations are separate from incoming entrances.
- `studio-actors.js`, `studio-departments.js`, and `studio-lot-2d.js` only render/interpolate movement; drawing does not earn progress. Stationary actors cannot select a walking frame. Canvas/UI use one shared RAF, not per-agent timers. Hidden tabs suspend rather than accruing a giant time delta; management tabs keep tasks running while skipping lot drawing. Task planning is event/task-boundary driven; social scans are throttled. There is **no separate offscreen low-frequency AI tier**: authoritative movement/work still shares the fixed scheduler.
- Routines include writer drafting/review/discussion; stage preparation, rehearsal, coordinated takes and review; editor/VFX/audio workflows; executive reports, meetings and routed inspections; and real cinema entry, seating, watching, reaction and departure. Hired specialties use existing staff keys. Work requires the actual destination, the correct assignment context and an unsuspended workplace. Stage work is credited only during a ready take. Work lowers energy; routed breaks restore it. Social encounters require a nearby willing colleague and cooldowns, and do not interrupt an active take.
- The original `engine.js::tickProjects` remains the only phase/quality/financial authority. Its phase-week increment calls `StudioLotBridge.resolveProductionWeek`. A project requires **at least 8 simulated labor seconds AND a completed work task per required role**, and actual booked writer/director/cast participation where provided. Pre requires a writer, shoot/reshoot requires director/camera/actor, post requires editor. Studio operating crews fill unbooked roles, not absent booked talent. The optional `studioWork` ledger tracks role and per-agent seconds/completions for `phase|phaseWeek`; it is not another progress bar.
- Advancing a week dispatches that project into an existing facility and resolves up to **180 simulated seconds** through the very same navigation/task engine. Multiple projects can use one facility sequentially instead of requiring a new building per film. This is a synchronous weekly time-lapse: the renderer shows its final state, not every intermediate catch-up frame. A blocked or unavailable workforce delays the phase; existing weekly burn/formulas are unchanged. Merely watching, taking breaks, striking, discussing or waiting does not earn labor. No new salaries, rewards, quality formulas, talent-XP formula, ticket income formula or save-version reset was introduced.
- Legacy/custom talent IDs and writer/director ID fields resolve through the actual talent directory. Unknown booked references cannot satisfy a required booked worker. Agent skills expose source talent skill when available, not a parallel cosmetic training/XP economy.

## Art and controls

Original generated seven-role atlases each contain 112 frames: four directions × seven states × four frames. The generator adds small idle blink/breathing details. Rendering adds grounded shadows, four cached clothing palettes, contextual timed bubbles and distance-driven walking with interpolation. Existing original story-room props and verified CC0 furniture/nature/cars remain.

**Asset limit:** VFX, audio and lighting have specialty tasks but reuse editor/camera role poses; there are no dedicated instrument-by-instrument animations, lip sync, skeletal animation or unique face per employee. The small pixel characters are not cinematic actors. Motivation/mood and relationships are task-layer state; film quality and talent growth still use the established game formulas.

Normal employee selection shows current task, energy, mood and real assignment. Developer debug is off by default: press **F8** while the lot is visible, or launch with `?simDebug=1`. It exposes selected/visible agent identity, task, destination, route, failures, animation/frame, elapsed time, transition reasons/history and simulation timing. Route overlays are restricted to the displayed room/world. F8 is ignored in text inputs and on hidden management views. Pause and speed use the existing shared controls; reduced motion remains supported.

## Verification executed

- Logic: 10 spatial-engine groups, 11 complete-lot groups, and **16 living-agent groups**. Includes actual work positions, finite transitions, coordinated takes, fatigue/strike non-credit, real booked talent, shared facilities, legacy talent-ID references, no false cancellation celebrations, missing workplaces, blocked-route recovery, walked transfers, meetings/cooldowns, pause/save/load, interpolation and population scaling.
- Actual Chromium: desktop lot interactions, touch/mobile, five-room layouts at 1280×800 and 844×390, department interactions/clock/remount, plus new `test/lot-living-browser.cjs` exercising actual `tickProjects` with work and unchanged cash burn, no-workplace delays, live management views, pause and F8 debug. No page errors or missing HTTP assets in successful runs.
- Offline career reload and web/APK/Capacitor asset parity passed after staging. `npm run apk:web` and `cd apk && npx --no-install cap sync android` executed successfully. Running Capacitor from repository root is incorrect; its config is under `apk`.
- Existing smoke, UI, balance and five career-scenario components passed. The first aggregate run found the legacy-ID greeting bug. After repair, a complete `npm run test:all` rerun exited 0, including all nine sandbox groups, lot suites and six economic arcs. A final cancellation-reaction correction was then verified with the full 37-group lot suite and targeted sandbox/browser checks.
- Browser performance: 10 seconds each across campus/writers/stage/post, 1280×800 DPR2, 36 agents, concurrent regression load, headless Chromium/software graphics. FPS: **59.76 / 56.32 / 52.68 / 58.69**; p95 frame intervals **16.8 / 33.2 / 33.4 / 16.8 ms**. Adaptive canvas ratio changed from 2 to 1 in later rooms. Retained JS heap delta **375,260 bytes**, no browser errors or failed requests. Full machine-readable output is generated under ignored `test-results/lot-performance.json`.
- Engine-only population samples (150 fixed steps / five simulated seconds): 25/75/150 workplace-assigned agents. Typical measured time was about **33–45 / 59–118 / 128–175 ms**, depending on concurrent regression load. These are not 150-agent browser FPS or mobile-device benchmarks.

## Run locally

```sh
# No runtime server-side dependencies; serve the repository root.
python3 -m http.server 8080 --bind 0.0.0.0
# Open http://localhost:8080, start a career, choose Writers/Stage/Post/Cinema.
# Develop a real film from Slate; press Next Week to resolve its work shift.

npm run test:lot
npm run test:all
# Browser tools are optional development-only dependencies:
npm install --no-save puppeteer-core @sparticuz/chromium
npm run test:lot:living
npm run test:lot:browser
npm run test:lot:departments
npm run test:lot:mobile
npm run test:lot:layout
npm run test:lot:offline
SOAK_SECONDS=10 npm run test:lot:performance
npm run apk:web
(cd apk && npx --no-install cap sync android)
npm run test:packaging
```

On this sandbox, Chromium needs `LD_LIBRARY_PATH=/tmp/al2023/lib`; alternatively set `CHROME_PATH` to an installed compatible Chromium. Browser tests use port 8080 by default, configurable with `GAME_URL`.

## Explicit limits

No Java/Gradle APK compile, device/emulator/touch hardware test or Rust/WASM parity test was performed. JavaScript is deliberately the authoritative spatial backend. Weekly catch-up is synchronous and capped per project; extremely large multi-project careers can cost more CPU than short population samples. Existing long-career balance/scenario harnesses mostly test the established economic engine without the browser spatial layer; the new browser suite verifies its actual production connection, but is not a full spatially enabled multi-year career soak. There is no promise of novel choreography or unique artwork for every task.
