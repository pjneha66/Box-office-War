# Placement correction — 22 October 2026

User feedback: “Every thing misplaced”. The preceding asset pass added scenery
without a consistent room composition and did not prove visual layout correctness.

## Confirmed causes and fixes

- Rooms used the full canvas dimensions even while a 270px inspector covered them.
  The camera now fits a measured content rectangle between the toolbar, command
  deck/footer and inspector. Campus projection and input still share one camera.
- Interior furniture anchors/scales were arbitrary; some lounge pieces extended
  beyond the floor. A dedicated service strip now accommodates perimeter furniture,
  while the x=1..10 engine navigation/workstation grid is unchanged. Desk compositions
  are consistently sized and anchored to actual reserved workstation coordinates.
- Cinema seats used four columns while audience targets used three columns. Seats
  now follow precisely the same (3,6,9) columns and three-unit row spacing as agents.
- Stationary furniture, cinema seats and staff now participate in one depth-sorted
  draw queue. Workstation surfaces/equipment stay together; seat backs are behind
  the audience instead of covering their faces.
- Flat screen-space rectangles made windows/noticeboards/screens float over sloped
  walls. They now follow the corresponding isometric wall planes.
- Actors had a minimum 0.7 render scale while the camera could zoom far below that.
  This made employees huge relative to facilities and intercepted mobile taps.
  Physical sprites now follow world scale; accessible hit targets remain separate.
- Exterior trees were drawn over empty background. A continuous landscaped apron
  grounds them and connects the paved parking annex to the campus. Relocated a palm
  away from the visitor vehicle; no props occupy player construction cells.
- Inspector/palette top offsets were fixed at 50px even when the toolbar wrapped.
  They now follow measured toolbar height; inspector scrolling is bounded above
  the command deck. Department changes clear stale/unrelated inspectors.
- Overview labels no longer dwarf tiny buildings at low zoom. Selected facilities
  retain their labels; other labels appear at closer zoom levels.

No finance, career, route rules or save schema were changed.

## Executed checks

- `npm run test:lot:layout`: both 1280×800 desktop and 844×390 touch layouts pass:
  all five room bounds fit the usable scene rectangle, displayed station positions
  match the engine grid, long-name headers do not overlap the world and inspectors
  stay between the toolbar and command deck.
- `npm run test:lot`: 21/21.
- Desktop browser 9/9, mobile 5/5, departments 9/9, offline reload and packaging pass.
- Web bundle rebuilt; Capacitor Android assets synchronized and parity verified.
- `SOAK_SECONDS=5 npm run test:lot:performance`: four-room **quick check**, 59.94–60.08
  FPS, no failed assets/page errors, bounded retained heap. This is a 20-second check,
  not a new 120-second soak or a physical Android performance claim.
- Syntax checks and `git diff --check` pass.

The existing full economy/management aggregate was not rerun for this spatial
presentation correction. Native compilation and physical-device QA remain unverified.
Current real captures are in `screenshots/lot-{after,writers,stage,post,mobile}.png`.
