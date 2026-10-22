# Rebuild verification — 22 October 2026

## Final commands

All commands run at repository root unless stated otherwise. Browser checks used
headless Chromium, a Python static server on port 8080 and the sandbox's required
shared libraries (`LD_LIBRARY_PATH=/tmp/al2023/lib`). They do not imply physical
Android or WebView validation.

| Command | Result |
|---|---|
| `npm run test:all` | **Pass, exit 0**: existing smoke, UI, balance, five scenario playthroughs, nine sandbox steps, 21 lot contracts and six economy arcs. |
| `npm run test:lot` | 21/21: ten spatial engine cases and eleven full contracts. |
| `npm run test:lot:browser` | 9/9 logged groups: startup/assets/DPR, projection, building and employee selection, camera, construction and finances, pause, save/load, no console/HTTP errors. |
| `npm run test:lot:mobile` | 5/5: landscape facility tap, 44px controls, touch pan, pinch zoom, no page errors. |
| `npm run test:lot:departments` | 9/9 logged groups: authoritative paid upgrades; actual working writers and indoor selection; shoot/post phase transfer; shared clock; expand/restore; remount; real Develop action; no errors. |
| `npm run test:lot:offline` | Pass: offline reload resumes cash/layout; all 16 new art/metadata files return successfully offline; previously unvisited departments open. |
| `npm run test:lot:performance` | Pass: four × 30-second actual browser soak; values below. |
| `npm run apk:web` | Pass: current root runtime and original art copied into `apk/www`. |
| `cd apk && npx --no-install cap sync android` | Pass: latest web bundle synchronized to Android assets. |
| `npm run test:packaging` | Pass: offline manifest inventory, root/APK/native JS/CSS byte parity, original art parity and staged native HTML parity. |
| `node --check` for engine, renderer, actors, departments | Pass. |
| `git diff --check` | Pass. |

The six economy arcs assert finite cash/gross, nonnegative debt and save round-trips,
not guaranteed business success. Five deliberately aggressive arc policies ended
in bankruptcy; their invariant checks still passed. No balance rules were changed
to manufacture winning outcomes. The smoke suite intentionally prints a corrupt-
save rejection while testing invalid input; it finishes `ALL CHECKS PASSED [OK]`.

Browser scripts require optional QA-only packages, not game runtime dependencies:

```sh
npm install --no-save puppeteer-core @sparticuz/chromium
python3 -m http.server 8080 --bind 0.0.0.0
# In another terminal, with local Chromium libraries available:
npm run test:lot:browser
npm run test:lot:mobile
npm run test:lot:departments
npm run test:lot:offline
npm run test:lot:performance
```

`CHROME_PATH` can choose another local Chrome executable. `GAME_URL` can point at
a different test server. Performance default is 30 seconds per room;
`SOAK_SECONDS=5` is only a quick smoke check, not the sustained result below.
The production game remains static, with no package/server dependency.

## Sustained measured performance

1280×800 viewport, DPR 2, headless Chromium CPU/Skia software graphics. One canvas,
Auto quality, four sequential live rooms, initial production and release-crowd
fixture. Agents complete their real attendance and depart during the run rather
than being artificially kept alive to inflate counts. FPS comes from actual RAF
intervals; draw/simulation durations come from renderer instrumentation.

| View | Seconds | Frames | FPS | Median / p95 frame interval | Mean draw / simulation CPU |
|---|---:|---:|---:|---:|---:|
| Campus | 30.006 | 1800 | 59.99 | 16.7 / 16.7 ms | 0.330 / 0.119 ms |
| Writers | 30.014 | 1793 | 59.74 | 16.7 / 16.8 ms | 0.367 / 0.129 ms |
| Soundstage | 30.005 | 1783 | 59.42 | 16.7 / 16.8 ms | 0.338 / 0.045 ms |
| Post | 30.003 | 1796 | 59.86 | 16.7 / 16.8 ms | 0.349 / 0.014 ms |

Forced-GC retained JS heap: **2,416,896 → 2,582,996 bytes (+166,100 bytes)**.
Zero page errors, zero failed asset requests, exactly one canvas throughout.
Assertions enforce ≥45 FPS, p95 ≤50 ms and retained heap growth <8 MiB. This is
not a total GPU/native memory measurement or a claim of physical-device battery,
thermal or frame performance.

An earlier launch inherited Sparticuz's forced in-process Swiftshader flags and
showed severe intermittent 4–17 FPS despite submillisecond JS work. It is **not a
performance pass**. A second such run was stopped. Removing the app's expensive
composited overlays and using a minimal direct CPU/Skia Chrome launch made the
harness reliable. All final browser scripts use those same minimal launch flags;
the final above is a completed 120-second run, not an extrapolation from 30 RAFs.
No controlled original-code sustained benchmark was obtained, so no numerical
before/after speedup is claimed.

## Real visual evidence

- `screenshots/lot-before.png`: original-code baseline.
- `screenshots/lot-after.png`: rebuilt campus with purchased post facility.
- `screenshots/lot-mobile.png`: actual landscape touch-emulated browser.
- `screenshots/lot-writers.png`: working, selectable writers in live cutaway.
- `screenshots/lot-stage.png`: project in shooting department.
- `screenshots/lot-post.png`: project in post-production department.

These are browser captures, not mockups or image-generated concept art. Project
records in department/performance tests are controlled spatial fixtures. The
original JSDOM UI regression exercises actual script selection, talent attachment,
greenlighting, production advancement and release through management controls.

## Unexecuted and remaining limitations

- Native Gradle compilation was attempted but blocked: no Java/JAVA_HOME in this
  environment. No APK binary, emulator or physical Android test is claimed. Android
  SDK/Gradle downloads also need hosts outside this sandbox's allowed network.
- `cargo test` could not run because Cargo is absent. The original legacy WASM is
  intentionally inactive; canonical JS is used on both platforms. The new protocol
  is not implemented in Rust and no WASM feature-parity claim is made.
- APK production dependency installation reported **three moderate audit findings**.
  No broad unrelated dependency upgrade was attempted. Optional APK art-generation
  dev dependencies hit an old sharp certificate/download failure; production-only
  installation (`npm ci --prefix apk --omit=dev`) succeeded without weakening TLS.
- Touch emulation is not hardware validation. Portrait, screen-reader usability,
  long careers on low-memory devices and multi-hour soak coverage remain manual QA.
- Route reservations and occupancy prevent routine overlap, but are not a formal
  proof of deadlock-freedom under arbitrary player-created densely packed layouts.
- Original actor work animations are four-frame stylized loops. Room furniture is
  static; it is not described as a fully animated background illustration.
