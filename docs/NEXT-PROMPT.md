# Next-update prompt (copy everything inside the block)

Paste the block below into a fresh session. Replace the last line with what you want
next. The block already carries today's state, so the new session does not have to
rediscover it.

---

```
Continue the Box Office War redesign and bug-fixing work.

START BY READING, in this order:
  1. docs/UPDATE-BRIEF.md   (standing brief: design direction, traps, checklists)
  2. docs/MANAGEMENT-AUDIT.md
  3. git log --oneline -8 and git status

CURRENT STATE (verified today)
  - main is 45bdb60 — PR #12 merged. App version 33.4.
  - Work on a NEW branch from the latest main. Do not reuse old arena branches.
  - Static app, no build step. Preview: npm run serve  (python3 -m http.server 8080
    --bind 0.0.0.0). If port 8080 refuses to bind, kill the stale python http.server
    first — check ps / ss before starting.

WHAT WAS DONE TODAY (Story Department pass, shipped in 33.3 + 33.4)

  Redesigns
  - Develop rebuilt as the Story Department command deck: seven numbered sections
    (Scripts, Audience lab, Craft & vault, Rights market, Talent desk, Combos codex,
    Locations & partners) with all seven visible on top and a TOOLS row underneath:
    TOOL / TALENT · Agency packaging, TOOL / CONTRACTS · Picture partners,
    TOOL / AGENCY · Talent agency.
  - Greenlight desk (film development): five numbered desks — Writer, Director, Cast,
    Producer, Deal — on the pitch shell, with a persistent deal sheet, a live cost
    sheet, budget + five allocation sliders, shoot location, theme, festival entry,
    distribution, pre-sales and co-production. All legacy cards removed.
  - Pitch a film / Pitch a series share one studio shell and end in an animated board
    verdict (accepted / rejected / board vote failed).
  - Team desks show Director / Writer / Producer chairs side by side with Choose and
    Change, so no chair is buried under a long shortlist.
  - Cast directory now opens INSIDE every pitch as a searchable picker (Everyone /
    Free now / 5★ / Animal stars) and returns to the same step with the draft intact.
  - Location desk replaced the unreachable location-scouting modal (three entry
    points, contractable commissions, tax ledger).
  - Inbox rebuilt as the inbox desk; Notifications tab no longer renders card rows.
  - Sound is a real toggle (state dot, SOUND label, ON/OFF, aria-pressed, persisted).
  - Agency packaging + Talent agency desks reskinned onto the command shell.
  - Legacy 2D Lot button/tab removed; legacy navy-and-gold talent market retired.

  Bugs fixed
  - Location scouting was unreachable from the Arena preview and opened the wrong system.
  - Pitch a Film / Series errored, looked cramped, never resolved in a visible decision.
  - Notifications tab still showed the retired card rows.
  - A new career seeded ZERO animal actors; the weekly slice(-52) roster prune would
    have dropped them anyway. Now eight species per career, pruned-protected, saving
    tops up old saves; animals castable in film, series and greenlight.
  - "Cast directory" inside a pitch ran closeModal() and destroyed the draft.
  - Cameo was a boolean that grabbed the highest-power free actor; it is now a chosen
    star with a real fee, in both pitches and the greenlight.
  - Develop sections 06–07 were hidden under the tool strip at 1280–1440.
  - Sound control was a text swap with no state.

  Test coverage added
  - test/pitch-location-inbox-browser.cjs   (npm run test:pitch)
  - test/pitch-studio-greenlight-browser.cjs (npm run test:rebrand)
  Both assert computed styles and real clicks in Chromium, at five viewports.

DESIGN DIRECTION (do not drift)
  - Landscape-first studio tycoon, not a dashboard website.
  - Forest-green surfaces, warm-paper accents, brass highlights.
  - Editorial headings, numbered navigation, restrained controls.
  - Responsive: desktop, phone landscape, portrait.
  - Real career data only. Never invent metrics.

RULES
  - Do not repeat the old mistake: renaming buttons or restyling containers while the
    old content stays inside is NOT a redesign. Replace the interiors.
  - For every requested tab: inspect the page, click every sub-tab, open every
    button destination, inspect nested dialogs, forms, empty/success/error states,
    then replace legacy layouts and re-test the real game actions.
  - Legacy CSS (#modalRoot .modal, #app) uses !important. Verify COMPUTED styles in a
    real browser, not DOM classes. lot-gameplay.css kills modal animation on .modal *.
  - Preserve saves, control IDs and event bindings. Use existing engine functions.
  - Add a regression test for every bug fixed.
  - Check command-deck.css first for existing components (pitchShell, pitchGroup,
    pitchChips, pitchStat, castPickRow, openTalentPicker, commandMetric, developPanel)
    instead of adding duplicates.
  - Bump versioned assets + service-worker cache (bow-v78-cache today) for any
    front-end change; see the checklist in docs/UPDATE-BRIEF.md.

VERIFY (report actual results, never assume)
  npm run test:management
  npm run test:ui
  npm run test:engine
  npm run test:pitch        (story-department work)
  npm run test:rebrand      (story-department work)
  node test/header-visual-browser.cjs   (when browser deps are installed)
  node --check <changed files>  and  git diff --check

  Browser deps are not installed by default:
    npm install --no-save puppeteer-core@23 @sparticuz/chromium

DELIVERABLE
  Changed / passed / unverified report. State plainly what you did not verify.
  Do not claim every bug is fixed.

MY NEXT REQUESTED UPDATE:
[describe the screens, features or bugs you want changed here]
```
