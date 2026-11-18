# Fix batch: Collection/Playing redesign, Vercel removal, Help, audit fixes

## Collection and Playing (presentation only, no logic changes)
- `game/boc-premium.css` (new): styles the existing Collection markup (`boc-*`, `produce-*`, `stat`, `command-eyebrow`, `produce-stamp`, `bo-empty`) and the Playing chart and sub-tabs.
- `game/ui.js`: `chartTableHTML(rows)` (new) renders the weekend chart as a ranked box-office table (rank, bar, gross, week-on-week change). It only presents `weeklyChart()` rows. `vCollection()` wraps the Collection markup in `.boc-root`. The Playing sub-tab row uses `.play-seg`, which scrolls horizontally on a phone.
- `game/index.html` loads `boc-premium.css`. `game/sw.js` cache bumped to `bow2-rebuild-v3` and the stylesheet is listed in ASSETS.

## Vercel removed
- `vercel.json` deleted. `.gitignore` and `.zcodeignore` lose the `.vercel` entry.
- The in-app update check (root `index.html`) now reads `version.json` from `raw.githubusercontent.com/pjneha66/Box-office-War/main`, not `box-office-war.vercel.app`.
- `release.sh` step 6 verifies the published `version.json` on GitHub. Vercel wording removed.
- `RELEASE.md`, `apk/README.md`, `docs/ORION-SUBMISSION.md` updated.
- Agent-template files (`.agents`, `.opencode`, `.zcode`, `.dsh`) still mention Vercel as generic skill guidance. They are not about this game and were left alone.

## Help and Hall of Fame (decision)
- **Hall of Fame:** already exists in `game/challenges.js` (top 10, stored in `S.chal.hall`), inside the Challenges desk under Studio › Production. Kept there. A gear-menu copy would duplicate it.
- **Help:** did not exist in `game/`. Added `game/help.js` (`HELP_DESKS`, group `Help`), a short orientation sheet covering the four tabs, the Week loop, and the gear menu. `GEAR_GROUPS` now includes `Help`, and `collectDesks()` includes `HELP_DESKS`. It reads no state and writes nothing.

## Audit fixes
- **Version mismatch:** root `index.html` `app-version` and every `?v=` cache-buster moved from 43.1 to 43.2, matching `package.json`, `version.json`, and `build.gradle`.
- **Dead duplicate definitions removed** (the later definition already won at load time, so runtime behavior is unchanged):
  - `engine.js`: `fmtM`, `fmtG`, `fmtSubs` (earlier copies, and the 9770 `fmtSubs` shadowed by `ui.js`), `resolveDeepfake` (the 7273 copy, shadowed by the 9883 copy).
  - `ui.js`: `deepfakeModal` (the 10652 copy, which dropped difficulty tiers), `flashes` (the 303 copy, shadowed by 310).
- **Streamer threshold conflict:** the dead `canLaunchStreamer` (rep ≥ 35, cash ≥ $140M) was removed. The active gate (rep ≥ 40, cash ≥ $250M) stays, and matches the UI copy "Rep 40 + $250M".
- **`refreshDeskSheet`:** the audit said it was undefined. That was wrong. It is defined in `game/ui.js` (APK) and the calls resolve. No change was needed.
- **innerHTML review:** the APK `game/ui.js` has four `innerHTML` sites, all assigning rendered sheets. In the root `ui.js`, the 23 sites were reviewed. Two interpolations were escaped: the archetype `alt` attribute and the recovery-screen error message.

## Tests
- `npm test` passes (exit 0).
- `rebuild-*.mjs` matches the pre-change baseline: crew 1/53, licensing 51/1 (the same failing check, "at least one offer expired untouched"), talent_agency 1 fail, world 1 check fail, awards and most others pass. `rebuild-ui` still needs `CHROME_PATH` (not set in this sandbox).
- `test/rehome-tabs.mjs` passes.
