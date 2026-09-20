# Box Office War — Durable Memory

## Architecture Decisions

### Vercel Deployment
- **Project**: `box-office-war` (id: `prj_7jQ0tA2QIUVUYzk5F6caEDnmOJHM`)
- **Team**: `team_4A0PGgGszorFWHbAyAK2HBLx` (not `pramodjadhav1303-3552s-projects`)
- **Auth**: Token must be scoped to correct team; `vercel login` then `vercel --prod --scope=team_4A0PGgGszorFWHbAyAK2HBLx`
- **Static deploy**: No build needed, serves `index.html`, `engine.js`, `ui.js`, `data.js`, `style.css` directly from root
- **Latest deploy**: `dpl_4AEZZWBdu81tF4HnDeMekuwAJqap` → `https://box-office-war.vercel.app` (2026-09-20, v6 features + contract renegotiation)

### Git Branching
- `main` — production (updated via PR merges)
- `release/qa-verified` — QA-verified release candidate branch
- `deploy/v5-engine-ui` — ephemeral deploy branch (squash-merged to main)
- PR #7 merged `release/qa-verified` → `main` (3a37ead)
- PR #9 merged `deploy/v5-engine-ui` → `main` (aaf1b36)
- **v6 commits**:
  - `6a0ada5` feat: add film pitch wizard and regional box office summary
  - `8ee3cdb` feat: add film comparison, director's cut, save slot naming, keyboard shortcuts, stat tooltips
  - `46a5cbd` feat: add rival studio profiles, marketing campaign builder (already existed), test screening demographics
  - `b5162e7` feat: add franchise timeline view with visual track
  - `aec5d5a` feat: add talent contract renegotiation

## Failed Approaches

### Git Path Prefix Bug (commit 21ec79d)
- **Attempted**: `git show 21ec79d:Box-office-War-main/engine.js > engine.js` from wrong working directory
- **Failed because**: Local checkout was at `/Volumes/PJ DRIVE/open code/Box-office-War-main` but repo root was at `/Volumes/PJ DRIVE/open code`; files committed with `Box-office-War-main/` prefix
- **Correct approach**: Clone fresh repo in temp dir, checkout correct commit, extract files at root level
- **Verified**: Fresh clone at `/var/folders/jc/m0ysfh_j27sc_69z8c51dbvr0000gn/T/opencode/Box-office-War` worked; files at root with correct line counts (engine.js: 4085, ui.js: 3223)

### Vercel Auth Token Scoping
- **Attempted**: Deploy with token scoped to `pramodjadhav1303-3552s-projects`
- **Failed because**: Target project `box-office-war` lives on `team_4A0PGgGszorFWHbAyAK2HBLx`
- **Correct approach**: `vercel login` (device auth), then `vercel --prod --scope=team_4A0PGgGszorFWHbAyAK2HBLx`
- **Verified**: Deployed to `https://box-office-war.vercel.app` (dpl_Ez6VGjFJV9DmCxgcq2jLQ8feTidM)

## Bugs and Solutions

### 1. Boot brace in `upsertFranchise` (engine.js)
- **Bug**: Dropped brace killed `engine.js` at boot
- **Root cause**: Syntax error during v5 merge
- **Fix**: Restored brace, boot-verified
- **Verified**: 20-year idle sim clean (finite money, valid save, 398ms)

### 2. Game-over `||` precedence swallowing modal tail
- **Bug**: `||` precedence in Awards line swallowed modal tail (pre-existing breakage of game-over button)
- **Root cause**: Missing parentheses around modal condition
- **Fix**: Parenthesized and verified
- **Verified**: Game-over modal displays correctly

### 3. `importCode` validation accepting type-corrupt saves
- **Bug**: `importCode` skipped `validateSave`, accepting cash as string into live economy
- **Root cause**: Validation only in `loadGame/loadSlot`, not `importCode`
- **Fix**: Added `validateSave` call in `importCode` before migration
- **Verified**: Corrupt saves rejected, good imports still work

### 4. `forecastProject` `loc.rate` NaN
- **Bug**: v5 locations carry `rebate` not `rate`, producing NaN week-detail nets
- **Root cause**: Forecast loop used removed property
- **Fix**: Changed `loc.rate` → `loc.rebate` (one-word fix)
- **Verified**: Finance UI shows finite values, 20-year run clean

## Project Conventions

### File Structure (root level)
```
index.html
engine.js      # ~4180 lines, v6 simulation (film pitch wizard, regional summary, contract renegotiation)
ui.js          # ~3500 lines, v6 UI (film pitch wizard, regional box office panel, film comparison, director's cut, save slot naming, rival profiles, franchise timeline)
data.js        # 66791 bytes, game data
style.css      # ~28500 bytes, responsive + a11y + timeline styles
i18n.js        # EN/HI
sw.js          # Service worker
manifest.webmanifest
BASELINE.md    # Architecture survey
UPGRADE-REPORT.md  # Full upgrade docs
MEMORY.md      # This file
test/smoke.js       # Extended coverage + film pitch test + contract renegotiation
test/ui-test.mjs    # Portable ROOT (file-relative) + film pitch wizard test + film comparison test
```

### Commit Message Format
Conventional commits with scope:
```
Deploy v5: update engine.js and ui.js from release/qa-verified
- engine.js: 4085 lines, complete v5 simulation
- ui.js: 3223 lines, complete v5 UI with all 24 features
Certification: STABLE — NOT RELEASE CERTIFIED (0 open defects)

feat: add film pitch wizard and regional box office summary
- engine.js: pitchFilm() with commercial/critical/audience/risk scoring
- ui.js: filmPitchModal() 3-step wizard, regionSummaryPanel()
- test/smoke.js: tryFilmPitch() in simulation loop
- test/ui-test.mjs: film pitch wizard click-through
Certification: STABLE — NOT RELEASE CERTIFIED (0 open defects)
```

### Certification Standard
**STABLE — NOT RELEASE CERTIFIED** means:
- 0 open defects, all regressions fixed
- Live browser QA passed (desktop + 390px mobile)
- Automated suite unrun (no shell in environment)
- 6 scenario arcs unplayed end-to-end
- Keyboard/SR pass and modal focus trap outstanding (fast-follow)

## Dependencies

### Runtime
- Zero dependencies — pure HTML/CSS/JS
- Runs in any browser (mobile + desktop, offline)
- PWA: manifest + sw.js for offline support

### Dev/Deploy
- Vercel CLI 59.23.2
- Node 22.23.2
- Git 2.50.1
- No build step — static files only

## Research Findings

### Save Migration (v1→v5)
- Synthetic migration tested in `test/smoke.js`
- 5 migration steps (v2→v3→v4→v5)
- `validateSave` guards against type corruption
- `migrateSave` applies migrations sequentially
- Export/import round-trip byte-identical (43KB code)

### Performance
- `forecastProject` hoists `catalogValue()` out of 12-row loop (12 O(films) → 1)
- `ui.js` finance hoists `maxDebt()` to one call per render
- 20-year idle sim: 398ms total, finite money, valid save
- Render ~4ms, save ~1ms (44KB), ~1300 DOM nodes on richest tab

### v6 Features (2026-09-20)
- **Film Pitch Wizard** (engine.js: pitchFilm, ui.js: filmPitchModal): 3-step wizard mirroring series pitch
  - Step 1: Genre, scale, budget slider
  - Step 2: Distribution (rating, location, pattern, rollout, window, IMAX/premium/soundtrack/D&D/polish toggles)
  - Step 3: Talent picker (director→writer→producer→cast) + greenlight evaluation with commercial/critical/audience/risk scoring
- **Regional Box Office Summary** (ui.js: regionSummaryPanel): Top-of-tab panel aggregating intl gross by region across all released films
- **Enhanced regionPanel**: Already existed for live films; now also referenced in library via topRegionLine
- **Tests updated**: smoke.js tries film pitches during simulation; ui-test.mjs clicks through full film pitch wizard
- **Keyboard Shortcuts**: 1-7 tabs, Space=week, Shift+Space=×4, R=release, S=save, L=load, H=help, Esc=close modal
- **Stat Card Tooltips**: multiplier, legs, critics, audience with plain-language explanations
- **Film Comparison Modal**: checkbox selection in library → side-by-side stats (budget, opening, WW, mult, legs, critics, audience, profit, weekly chart)
- **Director's Cut**: 15% budget → critic +4, overall +3, legs +15%; available post-theatrical for films ≥120M WW
- **Save Slot Naming**: rename slots in Settings modal (persists to localStorage)
- **Rival Studio Profiles**: clickable cards in Box Office → detailed modal with strategy, slate, head-to-head vs you
- **Franchise Timeline View**: visual track with markers, entries (WW/opening/critics/profit), active assets (merch/park/game/streaming/publishing), fatigue-aware next-film window
- **Talent Contract Renegotiation**: when heat ≥2 and under contract, 15% chance/week they demand renegotiation; fee multiplier 1.2 + heat×0.15 + power×0.03; logged with old/new amounts; one-time per talent

## Roadmap

### Release Certification Blockers
1. Run `node test/smoke.js` and `node test/ui-test.mjs` (needs jsdom)
2. Play 6 scenario arcs: blockbuster, flop, debt-heavy, rapid-expansion, franchise, streamer
3. Keyboard-only walkthrough + screen-reader pass
4. Modal focus trap / Escape handling

### Technical Debt
- Pre-existing duplicate: `G.mezz` vs `studio.mezzDebt` (two mezzanine tracks)
- `docs/GAME-UPGRADE-PLAN.md` never created; task prompts served as spec
- Old-version (v1–v4) save migration exercised only synthetically in-test, not live

### Future Improvements
- `Intl` currency formatting
- Save-slot repair tool
- Breakpoint screenshots beyond 390px
- Performance measurements on large saves
- CI/CD pipeline for automated suite on push