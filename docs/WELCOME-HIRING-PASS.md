# New landscape welcome screen and real cast hiring

## Welcome screen replacement

Replaced the previous logo/resume-card arrangement with a masthead, original SVG
campus composition using existing licensed studio sprites, a light director's
setup desk, and a separate launch rail. Landscape setup scrolls independently;
the launch action remains visible. Existing-save resume stays on the overview.
Portrait adapts to one column. Origins, scenarios, difficulties, sandbox options,
slots and existing save handling remain in place.

Also corrected a verified legacy styling conflict: `#btnContinue` had inline
`display:none` without a save but computed to `flex`. A targeted hidden-state
rule now prevents a nonfunctional Continue action from appearing. English launch
labels no longer depend on emoji glyph availability. Existing localization keys
and non-English translations remain intact.

`test:start:layout` passed at 1280×800, 844×390, 667×375 and 390×844: isolated new
career, hidden Continue without a save, naming/launch, landscape bounds and
saved-career resume. Actual screenshots were inspected.

## Hire & contracts

People → **Hire & contracts** now shows the real talent directory with role and
name filters, available cast, explicit signing costs, project list fees and a
separate signed roster. Uses the existing `signContract()` and `contractDefs()`:
3-picture signing is $4M; 104-week exclusive signing is $8M. No new pricing or
production rule was introduced. Production/casting fees still apply separately.
Retired, locked, booked and already-contracted talent is not offered as available.

Successful signing synchronizes the canonical lot, persists it and refreshes
both lists immediately. **Back to People** includes the new persistent worker.
Failure/insufficient funds never adds a hire. Contracts and roster survive reload.

The older generated scout market had a confirmed defect: signing only pushed
an entry into `G.talent`, with no payment, contract or roster synchronization.
That separate path now also uses the existing 3-picture contract, synchronizes
and saves. Its displayed signing label now agrees with that contract price.
The $1 scouting refresh previously changed nonexistent `G.cash`; it now charges
`G.studio.cash` through the existing ledger and saves. Generated scout IDs are
checked against directory IDs, including after a reload resets the nid counter.
Cached scout results are invalidated when the career object changes.

## Verification

Passed `test:lot:hiring` desktop and touch landscape: real hire clicks, exact
charges, immediate signed/People list entries, one spatial worker per talent,
insufficient cash, role/search filters, exclusive duration, saved reload, legacy
market hire and ID safety after reload. Passed 42 lot logic groups, People,
individual interiors, room layout, construction, departments, offline and
stale-code browser suites. Web bundle rebuilt, Capacitor web assets synchronized,
packaging parity and `git diff --check` passed. No native APK compilation or
physical-device test was performed. UI module version 44.0, offline cache 62.

The existing Arena preview on port 8082 serves this work; an already-open browser
page still needs a normal reload. No player saves were cleared or migrated.

## Follow-up: restricted palette and old-theme bleed

Removed the stacked earlier welcome colour/layout blocks from lot-gameplay.css.
`welcome.css`, linked statically after the legacy stylesheets, now owns the
welcome screen. Palette: charcoal surfaces, off-white text, one muted sand
accent. Campus artwork is grayscale. Setup scenarios, difficulty buttons,
origin cards, slot cards, tags, inputs and resume all use that same palette.
Legacy decorative gradients, entrance animations, shadows and pseudo-elements
are disabled only inside the welcome screen. No game theme preference is erased.

`applyTheme()` keeps the browser chrome colour charcoal while on welcome and
restores the saved in-game theme colour when entering the game. CSS is a normal
render-blocking head link, not injected after startup. Offline manifest and APK
copy list include it. UI/CSS versions 45.0, offline cache 63.

Added `test:start:theme`: static render with page JS disabled vs running startup
has identical palette; boot with saved violet; cycle all nine game themes and
compare welcome surfaces plus all generated scenario/difficulty/origin/slot/tag
styles; verify no legacy gradients/shadows/animations; rerender controls; enter
the game and preserve violet; reload offline and retain the welcome palette.
Passed. Four-size landscape/portrait start tests, existing UI suite, 42 lot
logic groups and hiring also passed. The aggregate command reached its 180s
limit after the desktop interiors check; no process remained running afterward.
Reran the remaining interiors/offline/update/staging/sync/packaging chain
separately: all passed. No native APK compilation or device test.
