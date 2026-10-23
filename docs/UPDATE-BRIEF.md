# Update brief — how to run the next Box Office War pass

**How to use this file:** copy the section *“My next requested update”* at the bottom,
replace the placeholder with the screens, features or bugs you want changed, and paste
the whole thing as the next request. Everything above it is the standing brief: design
direction, what is already done, the mistakes not to repeat, and the verification gate.

Keep this file in the repo — a sandbox reset wipes local state, and uncommitted notes
are lost. Last refreshed for **v33.4** (PR #12 merged into `main`).

---

## Continue the Box Office War redesign and bug-fixing work

First, inspect the repository, `docs/UPDATE-BRIEF.md` (this file) and
`docs/MANAGEMENT-AUDIT.md` to understand the work already completed. **Work on a new
branch from the latest `main`.** PR #11 (dashboard/studio command deck) and PR #12
(Story Department rebrand, v33.3 + v33.4) are both merged.

### Design direction established

The game is a **landscape-first studio tycoon**, not a conventional dashboard website.
Use the established command-deck identity:

- Forest-green surfaces, warm-paper accents, brass highlights
- Editorial headings, numbered navigation, restrained controls
- Responsive desktop, mobile landscape, and portrait layouts
- Clear gameplay decisions and real career data — no invented metrics

### Work already completed

**Dashboard / Studio / shell (PR #11)**

- Dashboard: Command Deck, Management Desks, Project Tracker, Industry Pulse.
- Studio: Campus, Leadership, Strategy, Workforce, Reputation, Legacy.
- Dedicated redesigns for Leadership appointments, Workforce recovery, Strategy and
  board reviews, Picture Partners, Trophy Room, and Creative Lab.
- Redesigned header with studio identity, finances, calendar, simulation controls, and
  utilities.
- Settings: six navigable preference sections.
- Field Guide: four chapters, twelve searchable topics.
- Removed duplicate sub-navigation and leftover lot controls from management screens.
- Updated offline caching and APK asset registration.

**Develop / Story Department (PR #12, v33.3 → v33.4)**

- Develop rebuilt as the Story Department command deck with seven numbered sections:
  Scripts, Audience lab, Craft & vault, Rights market, Talent desk, Combos codex,
  Locations & partners.
- All seven sections sit on top with a **TOOLS** row underneath: `TOOL / TALENT ·
  Agency packaging`, `TOOL / CONTRACTS · Picture partners`, `TOOL / AGENCY · Talent
  agency`. Nothing is clipped at 1440 / 1280 / 1024 / 844×390 / 390×844.
- **Greenlight desk** replaces the old film-development wizard: five numbered desks
  (Writer → Director → Cast → Producer → Deal) on the pitch shell, a persistent deal
  sheet, a live cost sheet, budget + five allocation sliders, shoot location, theme,
  festival entry, distribution, pre-sales and co-production. No legacy cards remain.
- **Pitch a film / Pitch a series** share one studio shell: Concept → Team → Cast →
  Release → Review (film) and Format → Cast → Platform → Review (series), ending in an
  animated board verdict sheet (accepted / rejected / board vote failed).
- Team desks show the Director / Writer / Producer chairs side by side with
  Choose/Change, so no chair is buried below a 40-row shortlist.
- **Cast directory opens inside every pitch**, layered over the desk, searchable and
  filterable (Everyone / Free now / 5★ / Animal stars), returning to the same step with
  the draft intact.
- **Animal stars** now exist in every career (eight distinct species), survive the
  weekly roster prune, top up old saves, and are castable in films, series and the
  greenlight.
- **Cameo** is a chosen star rather than a checkbox, in both pitch flows and the
  greenlight; the fee line and booking show the actual name.
- **Location desk** replaces the unreachable location-scouting modal (three entry
  points, contractable commissions, tax ledger).
- **Inbox** rebuilt as the inbox desk; the Notifications tab no longer renders the old
  card rows.
- Legacy **2D Lot** button/tab removed; the legacy navy-and-gold talent market retired
  in favour of the cast directory.
- **Sound** is a real toggle (state dot, `SOUND` label, ON/OFF, `aria-pressed`,
  persisted to `bow_snd`).
- **Agency packaging** and **Talent agency** desks reskinned onto the command shell with
  live standing, bundle costs and roster.

### Bugs already fixed

- Multi-picture contracts now connect to casting, locked fees, greenlight consumption,
  save/load, and completion. Signed partners get casting badges and sort priority.
  Duplicate picture consumption is blocked.
- Expired bookings no longer hide available talent; active bookings still prevent
  double-booking. The signing roster’s twelve-person limit is gone.
- Workforce recovery no longer targets string IDs, unknown talent, insufficient funds or
  fails to save.
- Random film pitching no longer selects a series-only genre.
- Achievement data, zero-valued relations, and project-count inconsistencies fixed.
- Location scouting was unreachable from the Arena preview and opened the wrong system.
- Pitch a Film / Pitch a Series errored; the dialogs were cramped and never resolved in
  a visible decision.
- The Notifications tab still rendered the retired card rows.
- A new career seeded **zero** animal actors, and the weekly `slice(-52)` roster prune
  would have dropped them anyway.
- “Cast directory” inside a pitch ran `closeModal()` and destroyed the pitch draft.
- Cameo was a boolean that always grabbed the highest-power free actor.
- Develop sections 06–07 sat underneath the tool strip at 1280–1440.
- The sound control was a text swap (`Sound on` / `Sound off`) with no state.

### Important lesson: do not repeat this mistake

Earlier changes renamed buttons or restyled containers while leaving the old content
inside. **That is not a complete redesign.**

For every requested tab:

1. Inspect the main page.
2. Click every sub-tab.
3. Open every button’s destination.
4. Inspect internal tabs, forms, nested dialogs, empty states, and success/error states.
5. Replace remaining legacy layouts — not just their names or colours.
6. Preserve and test the actual game actions.

Legacy CSS uses high-specificity selectors such as `#modalRoot .modal` and `#app`, often
with `!important`. These previously restored gold arcade frames, blue gradient title
bars, raised buttons, and decorative icons over the new design. **Check computed styles
in a real browser, not only DOM classes.**

Related traps found during the 33.x passes:

- `lot-gameplay.css` kills animation on `#app *` and `.modal *`; a new modal animation
  needs `!important` plus a positive `animation-delay`.
- `openModal()` must test `opts.className` before the `dashboard|studio` branch, or the
  management workspace shell overrides an explicit command skin.
- A `data-tab` button with no matching `else if(TAB===…)` falls through to the Kairo
  banner; adding a view branch **and** adding the tab to the `kairoBanner` exclusion list
  are both required.
- `render()` is guarded — call `_renderImpl()` or await ~250 ms in tests.
- Re-rendering a wizard mid-flow is how these desks keep state. If you add a nested
  dialog, stash the draft (see `WZ`) and re-render after the choice.

### Implementation and verification

- Preserve existing saves, control IDs, event bindings, and working game systems.
- Use real state and existing engine functions.
- Add regression tests for each bug fixed.
- Review `command-deck.css` and existing helpers before adding duplicate components
  (`pitchShell`, `pitchGroup`, `pitchChips`, `pitchStat`, `castPickRow`,
  `openTalentPicker`, `commandMetric`, `developPanel`, …).
- Run:

  - `npm run test:management`
  - `npm run test:ui`
  - `npm run test:engine`
  - `node test/header-visual-browser.cjs` when browser dependencies are available
  - `npm run test:pitch` and `npm run test:rebrand` for story-department work
  - Relevant syntax checks (`node --check <file>`) and `git diff --check`

- Verify desktop, phone landscape, and portrait layouts.
- Update versioned assets, offline cache, and APK packaging when necessary.
- Report exactly what changed, what passed, and what remains unverified. Do not claim
  every bug is fixed.

### My next requested update

**[Describe the screens, features, or bugs you want updated here.]**

---

## Repo quick facts (checked against v33.4)

**Local preview.** `npm run serve` → `python3 -m http.server 8080 --bind 0.0.0.0`
(static files, no build step). Restart it after a sandbox reset; port 8080 refuses to
bind while an orphan server holds it, so check `ps`/`ss` first.

**Browser tests.** Chromium is not installed, and a stock download misses
`libnspr4.so`. The working recipe:

```bash
npm install --no-save puppeteer-core@23 @sparticuz/chromium
# then the suites inflate al2023.tar.br and prepend /tmp/al2023/lib to LD_LIBRARY_PATH
```

`@sparticuz/chromium` uses animal ids like `bear`, `pand`, `eagl`; resolve species,
never seed an animal with a made-up id.

**Where things live**

| Area | File |
| --- | --- |
| Command-deck CSS (nav, panels, pitch, verdict, desk, inbox) | `command-deck.css` |
| Views, dialogs, wizards, inbox, campus/studio screens | `ui.js` |
| Simulation: greenlight, contracts, bookings, weekly tick | `engine.js` |
| Box Office Sim 2 cast integration | `box-office-sim-2-cast.js` |
| Location desk data + tax rebates | `film-locations-tax.js`, `location-scouting.js` |
| Agency packaging / talent agency desks | `talent-agency.js` |
| Animation-killer rule to work around | `lot-gameplay.css` |
| Regression suites | `test/` |
| This brief | `docs/UPDATE-BRIEF.md` |

**Version bump checklist** (do all of them or browsers serve stale files):

1. `index.html` — `meta[name="app-version"]` and every `?v=` stamp (currently `33.4`
   for the app, `ui.js` / `command-deck.css` at `48.1`, `engine.js` at `46.6`,
   `box-office-sim-2-cast.js` at `44.1`, `talent-agency.js` at `33.4`).
2. `sw.js` — rotate the cache name (`bow-v78-cache` today).
3. `version.json`, `package.json`, `package-lock.json`.
4. `apk/build-www.js` `FILES` list if a new top-level asset was added.

**Test timings** (rough, this sandbox): `test:engine` 35–160 s, `test:ui` 100–165 s,
`test:management` 25–30 s, `test:sandbox` 30 s, `test:pitch` 10 s, `test:rebrand` 11 s,
`node test/develop-deck.mjs` 14 s, `node test/develop-deck-browser.cjs` 5 s. Give the
long ones a generous timeout.

**Known gaps** (stated honestly, not failures): browser coverage is Chromium-only; the
agency bundle attach flow still uses the browser `prompt()`; the two browser suites
depend on optional local packages that are not declared in `package.json`.
