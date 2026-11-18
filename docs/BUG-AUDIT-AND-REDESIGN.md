# Box Office War — Bug Audit & Redesign Proposal (v43.2)

Scope: review only. **No game logic was changed.** This document lists the bugs
found and proposes a visual/structural redesign that keeps every rule, number and
engine behaviour exactly as it is today.

Base commit: `493594e` (v43.2). Branch: `arena/dfb8af3b-box-office-war`.

---

## 1. How this was checked

| Check | Result |
|---|---|
| `node --check` on every top-level `*.js` | all pass |
| `node test/smoke.js` | pass |
| `node test/collection-engine.mjs` (25 checks) | pass |
| `node test/ui-test.mjs` | pass |
| `node test/balance.js` | pass |
| `node test/scenario-playthrough.mjs` (4 scenarios to wk 200) | pass |
| `node test/sandbox-audit.mjs` (52-week sandbox) | pass, 0 runtime errors |
| `node test/stage-division.mjs` | pass |
| Duplicate top-level function scan (`ui.js`, `engine.js`) | 7 duplicated names — see §2 |
| `getElementById` IDs vs `index.html` | all 16 referenced IDs exist |
| Version strings across repo | mismatch — see §2.6 |
| Headless browser screenshot | **not possible** in this sandbox (Chromium missing system libs) — visual items below are from code review, not screenshots |

Test runs used `npm install` (dev dependencies only); `package-lock.json` was restored afterwards and no tracked file was modified.

---

## 2. Bugs found

Severity: **High** = wrong player-facing rule in effect · **Medium** = dead/conflicting code that will bite on the next edit · **Low** = cosmetic or stale metadata.

### 2.1 `canLaunchStreamer()` defined twice with different rules — **High**
- `engine.js:5135` → `rep >= 35 && cash >= 140`
- `engine.js:6361` → `rep >= 40 && cash >= 250` ← **this one is active** (later definition wins in a classic script)

The UI (`ui.js:6003`, `ui.js:10569`) gates the streamer launch on the active version, so the 35/140 rule is dead. The two rules disagree, so anyone reading the earlier definition will reason about the wrong threshold.
**Decision needed:** keep 40/250 (what players currently get) and delete the 35/140 copy, or change the intended threshold. Do not silently pick one.

### 2.2 `resolveDeepfake()` defined twice — **Medium**
- `engine.js:7273` `resolveDeepfake(correct)` — dead
- `engine.js:9883` `resolveDeepfake(correct, opts)` — active, with tier/streak/cost logic

Caller `engine.js:6217` passes one argument, so it runs the active version with `tier=0`. Works today, but the dead copy has different reward/cost behaviour. Remove the dead copy once §2.1-style intent is confirmed.

### 2.3 `deepfakeModal()` defined twice in `ui.js` — **Medium**
- `ui.js:10652` — dead
- `ui.js:12471` — active (tiered difficulty UI, calls `resolveDeepfake(correct, {tier})`)

The dead version calls `resolveDeepfake(hit)` with no tier. If anyone "fixes" the wrong copy, the tier system silently disappears.

### 2.4 `flashes()` defined twice in `ui.js` — **Medium**
- `ui.js:303` — simple toast loop, dead
- `ui.js:310` — notification-bell version with a 4-toast cap and same-week de-dupe (active)

The dead line is a leftover from before the v28.16 notification change. Delete it.

### 2.5 Number formatters defined twice in `engine.js` — **Medium**
- `fmtM` at 835 (dead) and 9800 (active); `fmtG` at 848 (dead) and 9805 (active); `fmtSubs` at 6517 (dead) and 9812 (active)

The active `fmtM` renders negatives with a Unicode minus (`−`) and uses `fmtNum`; the dead copy uses ASCII `-` and `Math.round` rules. Any test or string-match written against the dead version (or copy-pasted from it) will fail. Keep the active versions; delete the others.

### 2.6 Version numbers disagree — **Low**
| Location | Value |
|---|---|
| `index.html` `<meta name="app-version">` | `43.1` |
| `index.html` asset `?v=` query strings (77 occurrences) | `43.1` |
| `package.json` | `43.2.0` |
| `version.json` | `43.2` |
| `apk/android/app/build.gradle` | `43.2` (versionCode 55) |

Stale `?v=43.1` cache-busters can make a returning browser keep old CSS/JS after an update; bump them with the release script.

### 2.7 Stale APK in the repository — **Low**
`apk/dist/` contains only `BoxOfficeWar-32.13.apk`. The current build (v43.2) is published only as a GitHub release asset. Either stop tracking APKs in git or add the current one with the release.

### 2.8 Stale packaging docs — **Low**
- `apk/RELEASE-PIPELINE.md` refers to `/tmp/bow-main`, `v42.5` / `v42.8`, and `versionCode 54`.
- `apk/README.md` examples use `28.15 → 28.16` and Homebrew paths.
Both should be rewritten around `release.sh` and the current version.

### 2.9 Items to verify (not confirmed bugs)
- `ui.js` has 23 `innerHTML` assignments. Most user-visible strings go through `esc()` (606 calls), but the rendering code is large enough that a single unescaped studio or talent name would be an injection point. Worth a targeted review of any string that comes from player input (studio name, custom sandbox names, talent names).
- `index.html` loads 40+ classic `<script>` tags that share one global scope. The duplicate names in §2.1–2.5 are a symptom of this. A longer-term fix is module scoping (§4, Phase 2).

---

## 3. Recommended bug-fix order (logic-safe first)

1. **Delete dead duplicates** only after confirming the active copy is the intended one — §2.2, §2.3, §2.4, §2.5. Re-run `npm test` after each deletion.
2. **Decide §2.1** (streamer threshold) with the game designer before touching it.
3. **Sync version strings** (§2.6) through `release.sh`.
4. **Refresh packaging docs** (§2.8) and decide on APK tracking (§2.7).
5. **Targeted XSS review** of player-input paths (§2.9).

---

## 4. Redesign proposal — visual and structure only

Goal: a cleaner, more readable portrait-first experience. Game rules, numbers, save format and engine calls stay untouched.

### Phase 0 — Safety net (no visible change)
- Keep the full `npm test` suite green as the gate for every step.
- Add a screenshot baseline for the six bottom tabs at 360×740 and 390×844 (`scripts/capture-*.cjs` already exists; it needs a machine with Chromium system libraries).

### Phase 1 — Consolidate styling
Today the game loads **13 stylesheets** in `index.html`, including `command-deck.css` (403 KB), `style.css` (163 KB) and `bow-restyle.css` (52 KB), with overlapping rules overridden by later files.
- Make `design-tokens.css` + `system/tokens.css` the only colour, spacing and type source.
- Merge `ui-v33.css`, `bow-restyle.css`, `studio-nextwave.css`, `industry-expansion.css` into one component layer, then delete the overridden rules.
- Keep one skin. `index.html` already has a `data-skin` switch; keep "Toybox" (`system/game-ui.css`) and retire the classic graphite skin and the 13 theme looks in `theme-studio.css` unless they are a deliberate player feature.

### Phase 2 — Separate view from logic
`ui.js` is ~990 KB and mixes rendering with event wiring; `engine.js` is ~490 KB.
- Group render functions by tab (Studio, Develop, Now playing, Collection, Ledger, More) into view modules that only read state and call existing engine functions.
- Replace global `function` declarations with a single namespace object per module. This removes the duplicate-name risk in §2.1–2.5 structurally.

### Phase 3 — Visual redesign
- **Navigation:** keep the six-tab bottom bar that v43.x already uses; move the "week advance" control into one fixed footer so it is never hidden by a sheet.
- **Hierarchy:** one primary action per screen (e.g. Greenlight, Release, Advance week), styled as the single gold button; secondary actions as outlined chips.
- **Cards:** one card style for films, talent, deals and events (title, one key number, one status chip). Financial figures use the single formatter from §2.5 with tabular numerals so columns line up.
- **Modals/sheets:** one sheet component with consistent header, close button and focus trap (the codebase already has `role="dialog"` and `aria-modal`; make it universal).
- **Accessibility:** keep the existing skip link; check contrast of the muted text tokens against the dark background; respect `prefers-reduced-motion` for the confetti and animated crew effects.
- **Empty states:** every list (slate, talent pool, ledger) needs a short explanation and one next-step button.

### Phase 4 — QA gate
- Re-run all `npm test` suites (current baseline: all green).
- Screenshot compare each tab against Phase 0 baseline; approve visual diffs by hand.
- Run the 52-week sandbox audit to confirm no runtime errors after the CSS and view changes.

---

## 5. Out of scope here
- No balance changes, no new mechanics, no save-format changes.
- Decision on §2.1 (streamer threshold) is a design call, left to the owner.
