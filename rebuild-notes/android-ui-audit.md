# Android & UI Audit — Box Office War (rebuild input)

Audited 2026-11-14. Scope: apk/build-www.js, apk/capacitor.config.json, apk/android
(AndroidManifest.xml, variables.gradle), index.html, landscape-phone.css,
design-tokens.css (header), ui.js (nav/storage only — 12,599 lines, skimmed).
Method: every claim was checked against the cited file/line in this working tree.

## 1. Why it is hard to play on Android — concrete causes

### 1.1 Hard landscape lock; chrome eats the screen
- `apk/android/app/src/main/AndroidManifest.xml:16` — `android:screenOrientation="sensorLandscape"`.
  Portrait is impossible in the APK; the PWA gets whatever the device gives, so the two
  surfaces disagree.
- `landscape-phone.css:5–9` admits the damage: "at 844×390 the chrome alone consumed
  219px of 390, leaving a sliver of content" — top bar + 13-tab strip + per-desk nav on
  a phone held sideways.

### 1.2 Four competing navigation systems (the "messy UI" core)
- Desktop strip: 13 top-level tabs — `index.html:132–146`.
- Mobile bottom bar: 5 items, but "More" silently remaps to 4 unrelated tabs:
  `index.html:162–168`, `ui.js:892` (`btabMore` matches ott/empire/finance/games).
- `#subTabs` strip: `renderSubTabs()` `ui.js:2099–2124` hides itself for 11 of 13 tabs
  (`ui.js:2108–2111`) — dead UI on most screens; each desk then re-invents its own
  `command-section-nav` (Develop alone has 7 sections, `ui.js:2116–2124`).
- Net: two tab taxonomies that must stay in sync (13-strip vs 5-bar) plus per-desk navs.

### 1.3 CSS cascade war — 16 stylesheets, !important on both sides
- `index.html:18–37` loads 16 CSS files (~785 KB total; command-deck.css alone is
  403 KB / 3,298 lines). Order is load-bearing: system/* "loaded last so it wins over
  every legacy layer" (`index.html:30–35` comment), legacy-map.css re-points old
  palettes — two token systems (design-tokens `--gold` and legacy aliases
  `--green:var(--success)`, `design-tokens.css:28–40`) live simultaneously.
- Base touch rule armed with !important on ALL touch devices:
  `lot-gameplay.css:79` — `@media(pointer:coarse){ #app button,.modal button{min-height:44px!important} }`.
- Landscape layer counter-attacks with stronger/equal !important: header buttons 28 px
  (`landscape-phone.css:72,83,86`), desk buttons 34 px (`:195`), hides bottomnav+subtabs
  (`:97–99`), hides ledger chips 2–3 (`:42–43`), hides Field Guide (`:91`). Same
  selectors re-litigated across 4 media blocks (`:30, :226, :239, :250`).

### 1.4 Viewport / scrolling
- `index.html:5` — `width=device-width, initial-scale=1.0, viewport-fit=cover`; no
  dynamic-viewport (dvh) sizing; chrome is fixed px on a 360–430 px tall screen.
- The 2D lot stage renders under EVERY tab (`index.html:152–155`) — a full-width canvas
  layer + UI competing for 390 px of height.
- Scroll containment only on modals (`style.css:802,957`); page-level
  `overscroll-behavior-y:none` (`style.css:43`); horizontal strips rely on masked edges
  (`landscape-phone.css:100–107`).

### 1.5 Touch targets
- Portrait/touch: 44 px forced globally via !important (`lot-gameplay.css:79`) — which
  landscape-phone.css:193–195 calls "the single biggest reason the desks feel oversized".
- The landscape fix then shrinks BELOW guideline: 28–30 px header buttons
  (`landscape-phone.css:72–86`), 10–11 px fonts (`:86,:133`), 7.5 px chip labels (`:54`).
  Under Material 48 dp / WCAG 44 px — mis-taps are designed in.

### 1.6 Weight & startup cost
- 60 synchronous `<script src>` tags, no defer/async (`index.html:177–236`) — parse and
  execute serially before first paint: ~2.9 MB JS (ui.js 992 KB/12,599 lines,
  engine.js 490 KB/9,895 lines) + pkg/ WASM glue.
- 16 CSS files ~785 KB (style.css 162 KB; command-deck.css 403 KB).
- APK ships ~268 MB of assets/ (du: vendor 150 MB, itch-ui 32 MB, studio 24 MB, 2d 24 MB,
  bos2-icons 19 MB, itch-avatars 13 MB, pixel-characters 4.3 MB; only the 10 MB
  assets/store art is excluded, `build-www.js:34,51`). This dominates install size and
  cold-start scan.
- SW registration is stripped in the APK (`build-www.js:64–71`) — correct since
  Capacitor serves locally, but the PWA offline cache is dead weight inside the APK.

### 1.7 Persistence split (two stores, hand-synced)
- localStorage: 133 references across 10 files (ui.js 50, engine.js 43,
  settings-studio.js 12, studio-nextwave-suite.js 9, …).
- IndexedDB "BoxOfficeWar" additionally opened in `engine.js:131,138–139`;
  settings-studio.js and ui.js also touch it. Dual persistence with hand-rolled sync is
  a corruption/migration risk, and WebView storage can be cleared under device storage
  pressure — the offline banner (`index.html:41`) promises "changes saved locally".

## 2. Hard constraints any rebuild must satisfy
1. WebView baseline: Capacitor 8.5.2 (`apk/package.json`); capacitor.config.json sets
   no `android.minWebViewVersion` → library default **60**
   (capacitorjs.com/docs/config). minSdkVersion 24 = Android 7.0, target/compileSdk 36
   (`apk/android/variables.gradle`). Language floor Chromium 60: no CSS @layer (99+),
   no :has() (105+); JS must be ES2017-safe or transpiled.
2. Offline-first: only INTERNET permission; saves must remain local (IDB+localStorage);
   no network dependency at boot; SW block stripped in APK.
3. Orientation: APK landscape-locked (manifest:16); PWA/iOS may open portrait. Rebuild
   is landscape-primary (360–430 px tall) or must unlock the manifest.
4. Viewport ranges (landscape-phone.css:5–9,226–250): landscape phones 640–940×360–430
   primary; height 481–560 (small tablets); ≤800/≤720 px widths need progressive label
   shedding; ≥600 px height untouched. Bottom safe area via env(safe-area-inset-bottom)
   already relied on (`style.css:957`).
5. One navigation taxonomy; tab set must fit 360 px height without sub-10 px text.

## 3. How apk/build-www.js selects files (packaging contract)
- Hardcoded `FILES` array, `build-www.js:10–24` (~85 root files) copied 1:1 into www/.
  A new file added to the repo is NOT packaged until listed here — silent omission;
  typos fail loudly (copyFileSync ENOENT) but omissions do not.
- Directory copies: `assets/` recursive filtered to drop AppleDouble `._*` sidecars and
  assets/store/ (`:34,51`); `system/` minus styleguide.html (`:54–59`); `pkg/`
  recursive (`:61`).
- Post-processing: regex-strips the `/* PWA: … */` SW `<script>` block from the copied
  index.html and throws if absent (`:64–71`); prunes regenerated `._` sidecars last
  (`:73`).
- To package a new game folder: list files in FILES or add a `cpSync` block like
  system/pkg — AND add its `<link>`/`<script>` tags to index.html, or it ships but
  never loads.
