# Seating correction and department-room art pass

## Confirmed problems fixed

1. Desk/chair/monitor images had unrelated facing directions and anchors. New matched workstation artwork uses the same world-space contract: person at `(x,y)`, desk toward grid `-y`, monitor on its far edge, chair back on `+y`. The corresponding LPC seated profile faces screen upper-right (`east`). Writers retain their existing desk/room art; their chair alignment is corrected too.
2. The character compositor moved seated frames down eight source pixels and cropped their last eight pixels. This hid heads behind chair backs and truncated legs. Seated frames now preserve the full original 40×64 crop. A pixel-for-pixel source-comparison regression verifies it.
3. Stage workers and people between stations could use seated rest poses without chairs. Seating is now a pure presentation binding only for stationary, appropriate tasks at their actual reserved workstation. Walking, aisle traffic and stage work remain standing. Cinema watching/reaction uses the chair pose; departed/entering people walk normally.
4. Chair bases draw behind people and chair backs draw in front, using explicit world-depth ordering. Character seat height is calibrated to the cushion rather than reusing the standing-foot origin. Paper/camera/tool overlays are not pasted across seated operators' faces.
5. Career synchronization no longer erases the cinema's last screening title on every general production sync. Screening status and watching counts come from actual patrons/tasks, not decorative animation.

No actor position, route, authoritative direction, career save schema, work credit or financial formula is changed by room rendering. Debug now reports the presentation pose separately from movement direction and selects the correct seated animation frame.

## Four redesigned rooms

- **Executive:** warm timber and sage, walnut/brass-toned matched desks and correctly oriented PCs, paper/phone details, display storage, meeting table, lounge and coffee corner. Inspector treatment follows the cream/sage writers' room.
- **Post & VFX:** matching dual-monitor edit bays, a distinct sound-mixing console, grading preview, acoustic wall panels, speaker/rack/cart equipment, a darker working-floor inset and clear perimeter aisles.
- **Soundstage:** painted scenic flats, a warm timber set floor, lighting stands, equipment cases, monitor/cart gear, actual cast-position tape marks and a live take/phase header sourced from the shared simulation. No office chairs for standing crew; working camera crew/directors visually aim toward the actual performer, and performers face the camera operator.
- **Cinema:** a taller screening wall and properly proportioned large screen, curtains/acoustic panels, matched upholstered seating, carpet/aisle trim, speakers, projector and entry console. All seated patrons face the screen. The screen displays an original static illustrative city still during real screening activity; it is **not real movie video or a claim to depict the named film's actual footage**. An unoccupied screening room shows an inactive screen.

All rooms now use the writers' room's restrained heading/status hierarchy. Room bounds still fit the actual viewport and reserve toolbar/inspector/deck space. The existing 3/6/9 workstation grid and navigable floor are unchanged. Large scenery remains on wall/service strips instead of adding unmodelled obstacles to worker routes.

## Assets and changed interfaces

- `scripts/build-department-art.cjs`: 20 new original matched pixel-isometric props plus an original screening still. No new third-party license or runtime download.
- `assets/studio/department-furniture.{png,json}`, `screening-still.png`: locally bundled artwork.
- `scripts/build-lpc-people.cjs`, regenerated `assets/studio/people/*.png`: full seated-frame preservation; existing LPC attribution remains applicable.
- `studio-departments.js`: room styling, matched props, fitted cinema walls, split depth layers, pure `presentation(agent,view)` binding and additional layout diagnostics.
- `studio-actors.js`: seated/standing row selection, corrected seat height, no seated-tool overlay collision.
- `studio-lot-2d.js`, `lot-gameplay.css`: matching room chrome and pose-aware diagnostics.
- `studio-lot-engine.js`: retain cinema screening identity during unrelated sync.
- `index.html`, `sw.js`: visual module version 41 / offline cache 57; new artwork precached.
- `test/lot-seating.cjs`, `test/lot-room-design.cjs`: pure pose, source-pixel, atlas and real-browser room regressions. Offline tests include the new art.

## Executed verification

- `npm run test:lot`: **42 logic groups passed**, including three new seating/art groups.
- `npm run test:lot:rooms`: actual routed workers and screening patrons, five captured rooms, correct seat/standing frames, immutable simulation state, no page errors or missing assets.
- Desktop lot, departments, People, mobile touch, actual production integration and offline career reload suites passed.
- Five-room layout suite passed at **1280×800 and 844×390**, including canonical workstation anchors and inspector/toolbar bounds.
- `npm run apk:web`, Capacitor Android asset sync and packaging byte-parity checks passed.
- Short headless rendering check: three seconds each in campus/writers/stage/post, 42 agents, DPR2. Approximately **59.98–60.27 FPS**, p95 **16.8 ms**, no page errors or failed assets, retained JS heap delta **327,312 bytes**. This is a short software-browser sample, not a long soak, cinema-specific GPU benchmark or physical Android measurement.
- `git diff --check` passed. Full multi-year `test:all`, native APK compilation and physical-device testing were not rerun/performed in this pass.

Captured scenes: `screenshots/room-design-{writers,executive,post,soundstage,cinema}.png`.

## Run/rebuild

```sh
npm run art:departments
npm run art:people
npm run test:lot
npm run test:lot:rooms
npm run test:lot:layout
npm run test:lot:offline
npm run apk:web
(cd apk && npx --no-install cap sync android)
npm run test:packaging
```

Browser tests expect a static server on port 8080 (`GAME_URL` is configurable). This sandbox's packaged Chromium uses `LD_LIBRARY_PATH=/tmp/lib`. Refresh the live preview and choose the room tabs; an existing service-worker update may show the normal Reload prompt.

## Follow-up: locating the upgrade / stale code cache

The room art is available in this session's Studio lot preview: 2D Lot → Stage, Post & VFX, Cinema or Executive. Campus is the exterior view. It has not been deployed by this agent to a separate public site or compiled into a new installable APK. No new career is required.

A confirmed cache-policy defect could conceal updated visuals: ignoreSearch cache-first matching could serve an older unversioned renderer despite a new script version. Cache 58 now uses network-first loading for versioned JS/CSS, refreshes both canonical and versioned offline entries, and retains offline fallback. Worker registration bypasses the HTTP worker cache, checks for updates on startup, and saves before the update-bar Reload action. No player saves or localStorage are cleared. Campus instructions now point directly to the room tabs; desktop room headers identify ROOM ART 41.

`npm run test:lot:update` deliberately seeds a stale cached renderer, verifies fresh online code, verifies the updated offline fallback, then reloads the saved career offline and opens the upgraded Executive room. All checks passed. Offline, layout, room capture and packaging suites also passed after this follow-up.

### Arena preview follow-up

When the user still reported seeing the old appearance, a second static server
was started on port 8081, labelled **Updated room interiors — fresh preview**.
This is a separate preview origin, so its browser cache/storage is isolated from
the original port 8080; the original career save is not deleted or transferred.
Both `test:lot:rooms` (now using real room-tab clicks, not setView shortcuts)
and `test:lot:update` passed against port 8081. This verifies the fresh origin,
not the contents of the user's existing browser tab. User confirmation of the
new preview is still needed; if it differs, request their actual room screenshot.

## Campus construction fix

Reproduced the expansion failure in the 844×390 landscape preview: after a
facility was selected, the open Expand Campus palette covered the fitted campus
and intercepted intended ground taps. Selecting a facility now closes the
palette, clears the old inspector and leaves a persistent **Cancel build** button.
Cancel, Escape, Done and leaving Campus all clear construction state rather than
merely hiding the palette. Insufficient funds are reported before touch-confirm
preview. Placement/collision, costs and save schema are unchanged.

Added `test:lot:construction`: actual mouse and touch placement of all four
facility types, invalid-site rejection, exact cash deductions, two-tap touch
confirmation, four cancellation routes, insufficient funds and saved-layout
reload, on desktop 1280×800 and landscape touch 844×390. Passed.

Also passed: 42 lot logic groups; existing desktop, touch, departments (including
Expand/Restore), layout, offline and stale-code browser suites; web APK staging,
Capacitor sync and packaging parity. Fixed an update-test timing race by waiting
for the Continue button to be visible after offline reload. Renderer URL is now
41.1 and offline cache is 59. No save deletion, native APK compilation or device
verification was performed. Both existing preview servers serve these changes.

## Player-selectable room and theatre interiors

The bottom lot controls now include **Room interiors**. The editor lists every
actual room building (including additional constructed facilities) and an
**All rooms & theatre** target. From a department it defaults to that specific
building, so two facilities of the same type can have different finishes.

Choices: original / warm wood / cool slate / premiere wall palettes; original /
timber / carpet / checker flooring; original / sage / wine / navy chair and
cinema upholstery; original decorations / extra plants / awards displays.
Upholstery changes recolour only native seat pixels in a cached atlas while
preserving seat geometry, animation layering and the rest of the props. Extra
decorations occupy the front perimeter outside the workstation navigation grid.
No remote assets or dependencies were added.

Apply saves changes and shows an affected room immediately. Cancel has no save
side effects. Restore original targets either one room or all rooms. These are
explicitly free cosmetic choices, not new equipment/capacity/production bonuses.
An additive `G.lotInteriors[buildingId]` map is included in the existing career
JSON. Old or missing settings normalize to the original design without mutating
the save on read; no schema replacement or destructive migration is required.

`npm run test:lot:interiors` passed on desktop and landscape touch: all-room
application including cinema, individual theatre editing without affecting
other rooms, visible rendered changes, cancellation, reset, unchanged financial /
facility / building state, and reload persistence. Also passed 42 logic groups,
room art, layout, construction, departments, offline and stale-code regressions.
Web APK staging / Capacitor sync / packaging parity passed; no native APK compile
or hardware-device test. Visual module URLs are 42.0, service-worker cache 60.

## Correction: individual-only editors and landscape welcome screen

This supersedes the bulk-edit UI above. The user requested separate controls for
every individual room/theatre and reported the earlier editor was not working
for them. The exact cause in their browser was not established; a normal and
expanded desktop probe could operate the previous modal. The replacement makes
the flow explicit and improves action visibility instead of claiming a proven
underlying runtime fault.

- Campus **Room interiors** opens one named card per actual building. Each card
  opens that building's own editor. From a department the button goes straight
  to that room. Campus building inspectors also offer **Customise this interior**
  for supported room types (not the exterior gate).
- No all-room target, bulk save or bulk reset is exposed. **Save this room** and
  **Restore this room** use exactly one building ID. **Other rooms** returns to
  the separate room cards. Merely selecting finishes never overwrites a save.
- The editor identifies its room, marks choices unsaved, keeps actions sticky,
  fits a landscape viewport, and shows the changed room without an inspector
  covering it. Existing per-building saved choices remain compatible.
- Landscape welcome layout is now a left studio overview/resume pane and a
  separately scrollable right career setup pane. A saved career's Resume card
  is placed first and its button is visible without initial scrolling on tested
  landscape sizes. Portrait layout remains single-column. All origin/scenario/
  difficulty/slot controls remain present; no save was reset.

Tests: `test:lot:interiors` now edits each room separately and compares actual
fixed-viewport render pixels before/after for every room, checks no other room
changes, single-theatre reset, cancellation, persistence, financial invariance,
physical Save-button hit testing, and expanded desktop operation. Passed desktop
and landscape touch emulation. `test:start:layout` passed 1280×800, 844×390,
667×375 and 390×844 with isolated browser contexts, working studio-name input,
launch, immediate landscape resume visibility and saved-career resume.

Also passed 42 lot logic groups, rooms, layout, desktop, mobile, construction,
departments, offline and stale-code regressions. Rebuilt web staging, synced
Capacitor and passed packaging parity. No native compile/device verification.
UI module/CSS version 43.0, service-worker cache 61.
