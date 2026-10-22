# More people / detailed character art — 2026-10-22

> Latest seating and department-room corrections: [ROOM-DESIGN-PASS.md](ROOM-DESIGN-PASS.md).

## Visible change

The default lot now uses **24 composited LPC Revised character looks**, replacing the old block-person sheets in normal rendering. They include two body forms, six skin palettes, eight hairstyles, multiple hair/clothing colors, elderly heads and matching portrait crops. Walking uses the artist's **eight original directional frames**; idle uses three original poses. The same persistent appearance is used on campus, indoors, in the assignment inspector and in People cards.

The starter lot has **12 persistent operating workers rather than six**. Added named crew: Priya Desai (story editor), Julian Torres (researcher), Zara Okafor (lighting technician), Hana Kim (sound editor), Rafael Costa (VFX artist) and Imani Reed (production coordinator). They use the existing routed task/needs system and actual facility/project assignments. No decorative crowd loop, fake quality bonus, extra income, new wage formula or save reset was introduced. Existing operating roles are abstracted by established studio finances; these are not duplicate booked stars or pretend paid hires.

**People** replaces the footer's old BOS2 Talent shortcut. It opens the live personnel roster: portrait, identity, role, department, task and energy. Selecting a card locates that actual agent and opens their assignment inspector. **Hire & contracts** retains access to the existing talent-market action. Crew tasks/energy refresh through the shared render scheduler, not a new timer. Credits are available in the panel.

The room layout, grid, camera scale, workstations, financial rules and core progression were preserved. Additional crew keys migrate once into old spatial saves and do not duplicate on repeated sync/load. Demolished facilities are not silently recreated.

## Asset provenance — not just “free”

Discovery: [LPC Character Generator on itch.io](https://pflat.itch.io/lpc-character-generator), which explicitly points to the LPC artwork ecosystem and explains its attribution requirements.

Actual imported PNG source: [ElizaWy / LPC Revised](https://github.com/ElizaWy/LPC), pinned to `f07f7f5892e67c932c68f70bb04472f2c64e46bc`. These files were obtained from the artist-maintained GitHub repository, **not downloaded from itch.io's executable package**. Its selected per-part credits explicitly specify **OGA-BY 3.0**, not CC0. We did not import the generator executable, UI, music, fantasy weapons or unverified “free” packs.

Attribution: Stephen Challener (Redshrike), Eliza Wyatt (DeathsDarling), Durrani, Benjamin K. Smith (BenCreating), Johannes Sjölund (Wulax), bluecarrot16 and Thecilekli. Upstream credits are retained verbatim; all selected PNG layers and their immutable Git blob IDs are included under `assets/vendor/lpc-revised/`. See `NOTICE.md` and `sources.json` there for license URI, per-part credits, original paths and modifications.

All runtime art is local, available offline and included in the Android web bundle. No API key, paid asset or runtime external dependency is needed.

## Main files

- `scripts/import-lpc-people.py`: pinned, sparse source importer; gh needed only when re-importing.
- `scripts/build-lpc-people.cjs`: offline compositor; `npm run art:people` rebuilds the looks and portraits from checked-in layers.
- `assets/vendor/lpc-revised/`: original licensed layers, source manifest and credits.
- `assets/studio/people/`: 24 detailed atlases, portrait atlas and animation manifest.
- `studio-actors.js`: native rich-frame selection, sheet loading, matched portraits, contextual tool overlays; original role sheets retained as fallback.
- `studio-agent-life.js`, `studio-lot-engine.js`: persistent appearance migration and six additional task-driven operating crew.
- `studio-lot-2d.js`, `lot-gameplay.css`: People panel, matching inspector portraits and correct rich-atlas debug frames.
- `sw.js`, `index.html`: cache 56 / visual scripts 40.0, precached art and notices.
- `test/lot-people.cjs`, `test/lot-people-browser.cjs`: source integrity, identities, migration, art, roster actions and mobile checks. Existing fatigue assertions now correctly inspect the resting individual's ledger, since other writers can legitimately keep working.
- `test/lot-offline.cjs`, `test/lot-packaging.cjs`, `package.json`: explicit detailed-art offline checks, recursive artwork parity and runnable test/build scripts.

## Executed checks in this pass

- `npm run test:lot`: **39 logic groups passed** (10 spatial, 11 complete, 16 living, 2 new people groups).
- `npm run test:lot:people`: desktop roster, 24 loaded sheets, distinct portraits, locate/assignment, attribution, landscape touch layout, opaque flat panel styling and no page errors/assets missing passed.
- Desktop lot, departments, mobile touch, both layout sizes, actual living-production integration and offline reload suites passed. Offline coverage includes all 24 detailed sheets, first-use People panel, portrait atlas, notice and preserved career state.
- New source verification recomputes the original Git blob SHA for every imported layer/credit and checks 24 distinct generated images plus animation bounds.
- `npm run test:sandbox`: all nine steps / 52 weeks passed.
- `npm run apk:web`, Capacitor Android asset synchronization and packaging parity passed. No native APK compilation or physical Android verification.
- `git diff --check` passed. Full multi-year `npm run test:all` was **not rerun in this artwork pass**; its earlier result is historical, not new evidence.

### Short rendering measurement

Five seconds per view, headless software Chromium at 1280×800 DPR2, **42 agents** including screening attendees. Campus / Writers / Stage / Post: **49.94 / 59.26 / 60.02 / 59.79 FPS**. P95 intervals: **33.4 / 16.8 / 16.7 / 16.8 ms**. Adaptive rendering selected pixel ratio 1. Retained JS heap increased **302,756 bytes**; no page errors or failed asset requests. This is a short headless measurement under concurrent packaging load, not a mobile GPU or long-soak guarantee. Campus remains the heavier scene.

## Honest animation limits

The pack supplies walking, idle and seated poses—not bespoke movie-production choreography. Desk work/rest use the seated chair pose; standing crew work and social/reaction states reuse idle art with contextual tools/bubbles. Camera, slate, paper and sound-tool overlays are original additions. We do not claim dedicated artist-made filming, typing, lip-sync or emote cycles. The old role sheets remain a loading/error fallback.

npm installation also reported existing repository tooling advisories (root: one high; Android wrapper: seven total). No forced, potentially breaking dependency upgrades were made as part of this visual request.

## Try it

Open/refresh the **Studio lot** live preview. Start or continue a career, select **People**, then choose a worker to visit their room. Develop a film to see task-driven work rather than unassigned idle activity. Existing careers receive the additional crew without reset.

```sh
npm run art:people
npm run test:lot
# Optional development browser tools: npm install --no-save puppeteer-core @sparticuz/chromium
npm run test:lot:people
npm run test:lot:offline
npm run apk:web
(cd apk && npx --no-install cap sync android)
npm run test:packaging
```

The current sandbox uses `LD_LIBRARY_PATH=/tmp/lib` for the packaged Chromium libraries. Screenshots: `screenshots/lot-people-roster.png`, `lot-people-writers.png`, and `lot-people-mobile.png`.
