# Dashboard / Studio command-deck audit

> Standing handoff brief for the next pass: [`docs/UPDATE-BRIEF.md`](UPDATE-BRIEF.md).
> It records the design direction, everything shipped since this audit (PR #12 / v33.4),
> the legacy-CSS traps, and the verification gate.

## Coverage

`npm run test:management` boots the real app scripts in JSDOM. It covers all four
Dashboard sections and all six Studio sections, checks that 29 dialog-opening
buttons are wired and open command-styled destinations, and exercises:

- C-suite hiring and cash debit; backlot construction and cash debit.
- Achievement collection filters and Creative Lab workbench switching/creation.
- Multi-picture actor and director signing, insufficient cash, duplicate rejection,
  negotiated quotes, actual casting selection, greenlight consumption, duplicate
  consumption protection, busy-vs-expired bookings, persistence and completion.
- Film pitch initialization with the last film genre (previously a series-only
  documentary could be picked at random and break the budget calculation).

`npm run test:ui` and `npm run test:engine` also pass after these changes.
This is functional DOM/engine coverage, not a guarantee of absence of all bugs.
Browser screenshot tests require a Chromium environment with system libraries;
this sandbox lacks libnspr4.so, so visual/browser-layout verification is pending.

## Fixed defects

1. The modular picture-contract ledger was disconnected from film fees and
   greenlight accounting. The engine now reads locked quotes and consumes one
   commitment per unique participant per film, including cameo participation.
2. Re-consuming the same film used to decrement commitments twice.
3. The signing roster silently truncated to 12 people. It now lists the full
   non-retired roster and explains whether signed talent is currently booked.
4. Expired nonzero booking dates excluded otherwise-free talent from casting.
5. Signed partners lacked casting badges and could be buried by star sorting.
   Partners now sort first, carry rate/remaining-picture badges, and stay visible
   in the star filter. Signing does not override an active production booking.
6. Signing did not save or record its cash cost in the talent expense ledger.
7. Leadership hires and stage purchases now save successful UI transactions.
8. Legacy milestones read a different achievement store and could render empty.
9. Zero exhibitor relations incorrectly fell back to 50.
10. Project tracker could double-count scheduled productions and include delivered
    projects. It now counts and displays the same filtered project set once.
11. Film pitches used a hard-coded random genre list containing a series-only
    genre. They now use the actual film genre registry.
12. The redesigned Trophy Room footer preserves the shared close-action hook used
    by existing navigation/integration tests.

## Presentation

Every Dashboard subpage and Studio subpage now has a command-deck interior, not
only a new navigation label. Management desks, project tracker and industry pulse
have dedicated layouts; Studio pages share a new branded page frame and controls.
Dialogs opened from those tabs share the management theme, including nested
management dialogs. Trophy Room, Creative Lab and Picture Partners have their own
interiors. Existing domain actions and control IDs remain in place.

Versioned JS/CSS references, the offline cache, and APK asset registration include
these changes. Existing saves are retained; no save wipe is required.

## Header, Settings and Guide

The shared header now separates studio identity, career telemetry, simulation
transport, and utility navigation. Existing control IDs and handlers are retained.
The management landscape viewport uses an observed header height instead of the
legacy hard-coded 58px offset.

Settings now groups the actual controls into six navigable panels: experience,
audio, accessibility, career, saves, and device/privacy. Switching a preference
that rebuilds the dialog retains the selected panel. Existing save and import
handlers are preserved. IndexedDB backups are described as device backups, not
cloud sync.

The Guide now has four chapters, twelve searchable topics, explicit no-results
feedback, and coverage of picture partners and workforce recovery. The new
`test/header-settings-guide.mjs` exercises header links, guide chapter/search
filtering, Settings navigation, language, currency, font sizing, motion, temporary
mute, studio rename, export, and save-slot selection. This test is included in
`npm run test:management`. The full UI integration suite also passes.

## Rendered legacy-style regression (resolved)

A real Chromium run revealed that `#modalRoot .modal` and `#app` legacy
`!important` rules outranked the new component classes. This retained the arcade
modal frame, gradient title bar, bevelled controls, help-card backgrounds, and
header decorations despite the new markup. Explicitly scoped command-interface
boundaries now override those rules. Settings decorative emoji and translated
header emoji are removed without changing control IDs or language behaviour.

Chromium's bundled Linux libraries can be extracted from its al2023 archive in
this environment. `node test/header-visual-browser.cjs` now runs successfully and
checks actual computed styles and overflow at 1440×900, 844×390, and 390×844.
It verifies the one-pixel modal border, absence of modal/title-bar gradients,
flat header controls, no legacy chip pseudo-icons, and transparent editorial
Guide topics. This supersedes the earlier note that browser verification was
blocked. Browser dependencies remain optional local testing tools.
