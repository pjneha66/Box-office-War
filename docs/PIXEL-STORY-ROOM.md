# Selected pixel-tycoon direction — first complete screen

The user selected **Detailed pixel-art tycoon** rather than boutique/cinematic UI.
This pass redesigns the writers' room first, for visual review before applying the
same treatment everywhere. It does not claim a finished reskin of all management
pages or other departments.

## Implemented

- Original cohesive 13-prop pixel atlas: typewriter desks, chairs, colored book
  spines/shelves, plants, floor lamp, sage sofa, table, coat stand and coffee corner.
  Authored on a 64px pixel grid and enlarged nearest-neighbour to a 640×384 atlas.
  Source is `scripts/build-story-room-art.cjs`; regenerate with `npm run art:story`.
- Explicit per-sprite ground anchors (`ax:64, ay:98`) maintain alignment with real
  workstation coordinates; the same indoor paths, staff and production remain.
- Smaller purposeful room floor, sage workstation rug/inlay, wood walkway and a
  wall-plane story board. These are materials/static props, not new obstacles or
  simulated task/quality bonuses.
- Department heading and actual working/in-room counts. Compact cream inspector,
  consistent sage/brass controls and a production card bound to the real room's
  title/progress. Progress refreshes without rebuilding input controls.
- Nearest-neighbour texture rendering; no ornamental animation, glow or blur.
- Licensed Kenney furniture remains the fallback and the active art in other rooms.
  All earlier source/license files are retained. Characters still use the original
  shared animated role atlas, not a static room illustration.
- New art is precached and included in both web/Android staging. No save/economic
  changes, external runtime downloads or new independent rendering loop.

## Verified this pass

- `npm run test:lot`: 21/21.
- `npm run test:lot:browser`: 9/9.
- `npm run test:lot:mobile`: 5/5.
- `npm run test:lot:departments`: 9 logged groups, including pixel atlas readiness,
  actual selected project title, 25% production binding and live update to 50%.
- `npm run test:lot:layout`: both desktop and landscape-mobile, all five interiors.
- `npm run test:lot:offline`: new atlas/metadata included in offline resume check.
- `npm run apk:web`, Capacitor Android sync, `npm run test:packaging`: pass; runtime
  atlas rectangles, dimensions, anchor metadata and byte parity are checked.
- `SOAK_SECONDS=5 npm run test:lot:performance`: 20-second four-view **quick check**,
  59.93–59.99 FPS; clean errors/assets and bounded retained JS heap. This is not a
  new 120-second soak or a physical-device performance claim.
- Syntax checks and `git diff --check`: pass.

The full economy/management aggregate was not rerun for this presentation-only
pass. Native compilation and physical Android validation remain unverified.

`screenshots/lot-writers.png` is a real browser capture. Its “The Last Picture”
production is a controlled spatial test fixture (preproduction week 1/4), not a
claim that this test greenlit a film through the UI. The original management UI
suite exercised that workflow in the earlier implementation pass.
