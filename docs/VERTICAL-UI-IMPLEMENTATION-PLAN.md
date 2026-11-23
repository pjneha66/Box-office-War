# Box Office War — Vertical UI Implementation Plan (Execution Plan)

**Version:** 1.0 · **Date:** 2026-11-23 · **Status:** READY FOR EXECUTION · **Parent:** [`VERTICAL-UI-REDESIGN-PLAN.md`](./VERTICAL-UI-REDESIGN-PLAN.md) (IA + shell spec + tokens)

This document is the **execution plan**. It converts the approved redesign
(parent doc) into concrete, ordered, testable tasks. Every phase ends with a
shippable state where `npm test` is green. Nothing here changes engine or save
logic — the vertical UI is a rendering/chrome concern layered on top.

**Current state of the tree (v47.2):**
- Root `/` = landscape-first legacy app: 13 tabs, 13 stylesheets, ~9,800 lines CSS in the nine biggest files.
- `game/` = complete portrait-first rebuild (56 JS + 3 CSS, own `index.html`), ships in the APK via `apk/build-www.js --rebuild`.
- `system/tokens.css` = single source of truth (graphite + brass gold), but documents a *landscape* target.
- AndroidManifest locks `screenOrientation="portrait"` — the conflict this plan resolves.

---

## 0. Ground rules (apply to every task)

1. **Portrait is the source of truth.** All new/modified CSS targets a 360px-wide portrait phone as the primary viewport. Desktop/landscape are *enhancements* of the same DOM, not a second IA.
2. **One new layer:** `system/vertical.css`, linked after `system/tokens.css`, gated behind `data-layout="vertical"` on `<html>` (set by `system/components.js` / `mobile-shell.js`). No new `!important` in the new layer.
3. **Reuse the existing portrait shell.** `game/mobile-shell.css` + `mobile-shell.js` + `phone-ux.js` already implement the correct chrome. The root app adopts the same shell rather than inventing a new one.
4. **Delete, don't overlay.** Where the legacy `style.css`/`command-deck.css` contradicts vertical-first layout, the vertical layer wins and the dead rule is removed in the cleanup phase — not `!important`-overridden forever.
5. **No engine/save changes.** `engine.js`, `data.js`, save format, and all `game/*.js` feature modules are untouched by UI work. `test:guards` (bundle-integrity, style-coverage, no-phantom-hooks) must stay green.
6. **Test gate after every phase:** `npm test` (smoke, collection-engine, ui-test, balance, scenario, sandbox, stage-division, guards) + `npm run test:rebuild` (all 23 rebuild modules).

---

## Phase 1 — Foundation: tokens + vertical shell skeleton

**Goal:** A portrait shell that renders on the root app behind a flag, with zero visual regression on desktop. Deliverable: `system/vertical.css` + flag wiring + a 360px before/after.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| 1.1 | Flip the token source-of-truth comment + add vertical-first density tokens (spacing, bar heights, touch targets) to `:root`. | `system/tokens.css` | Tokens named `--v-*` (e.g. `--v-bar-h`, `--v-tap`, `--v-gap`) with portrait-phone defaults. |
| 1.2 | Create `system/vertical.css`. Add `:root[data-layout="vertical"]` scope for shell tokens. | `system/vertical.css` (NEW) | File linked in `index.html` after `system/tokens.css`; empty file + token block is valid CSS. |
| 1.3 | Wire the flag: set `document.documentElement.dataset.layout = "vertical"` when a portrait/phone viewport is detected (or `bow-mobile` class present). | `system/components.js` or `mobile-shell.js` | Flag is set on body/html at boot; no-op on desktop unless opted in. |
| 1.4 | Add the vertical app bar (`--v-bar-h: 56px`): brand/studio name, Capital chip, week chip, Inbox + Settings icons. | `system/vertical.css` | Renders 56px; chips use `--v-*` tokens; hidden under 760px desktop rail. |
| 1.5 | Add the sticky sub-nav (`--v-sub-h: 44px`) — the 5 destinations. | `system/vertical.css` | Sticky; 44px min height; active state via `data-tab`. |
| 1.6 | Add the pinned Next-Week action bar (`--v-action-h: 64px`) with the single Next Week button. | `system/vertical.css` | 64px; single CTA; replaced by FAB only in collapsed mode. |
| 1.7 | Add the 64px bottom nav (5 destinations, icon + label). | `system/vertical.css` | 64px; 44px tap targets; safe-area bottom inset. |
| 1.8 | Capture 360px screenshot of the shell (app bar + sub-nav + empty `#view` + action bar + bottom nav). | screenshots/ | Image saved; shell renders without console errors. |

**Phase 1 exit:** `npm test` green; shell renders at 360px; desktop renders unchanged (flag off).

---

## Phase 2 — Nav unification: one 5-destination model

**Goal:** Replace the 3 competing nav systems (desktop tabs, bottomnav+subtabs, command-deck) with the single 5-destination vertical nav. Deliverable: all 13 tabs mapped, "More" sheet deleted, Notifications → header inbox.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| 2.1 | Build the destination → tab map (Home/Create/Market/Studio/Business) and the 71-sub-section index from `TAB_META`. | new `system/nav-map.js` or inline in `ui.js` | Every one of the 13 tabs resolves to a destination; ≤2 taps to any sub-section. |
| 2.2 | Wire the 5 bottom-nav buttons to `switchTab()` with the new destinations. | `ui.js`, `system/vertical.css` | Clicking a destination renders the correct tab; active state updates. |
| 2.3 | Add the sticky sub-nav that lists the destination's sub-tabs (derived from the map). | `ui.js` render, `system/vertical.css` | Sub-nav shows the sections of the active destination only. |
| 2.4 | Delete the "More" sheet path (`moreSheet()` at `ui.js:1013`) and its bottom-nav entry. | `ui.js`, `index.html` | `data-tab="more"` no longer renders; bottom nav has 5 buttons, not 6. |
| 2.5 | Move Notifications out of the tab strip into the header inbox icon (`#btnInbox`). | `ui.js`, `system/vertical.css` | Inbox icon opens the notifications view; no Notifications tab remains. |
| 2.6 | Collapse `renderSubTabs()` for the 11/13 tabs that currently early-return — route them through the sub-nav instead. | `ui.js` (`renderSubTabs`) | No tab is unreachable from the vertical nav. |
| 2.7 | Remove the duplicate Next Week controls: keep the action-bar CTA, delete the header `#btnWeek` and the `#fabWeek` FAB (one CTA). | `index.html`, `style.css`, `ui.js` | Exactly one "Next Week" advance control in the vertical shell. |
| 2.8 | Verify reachability: a tap path exists to all 13 tabs and their sub-sections. | test / manual | Reachability matrix passes; no orphan tabs. |

**Phase 2 exit:** `npm test` green; all 13 tabs reachable in ≤2 taps; "More" gone; single Next-Week CTA.

---

## Phase 3 — Desk-by-desk migration (portrait-first restyles)

**Goal:** Restyle each desk's content for single-column portrait. Order by usage frequency; each desk ships independently. Deliverable: migrated views in `system/vertical.css` + view-specific tweaks.

**Migration order (each a sub-task with its own AC):**

| # | Desk | Current treatment | Vertical treatment |
|---|------|-------------------|-------------------|
| 3.1 | Dashboard | Multi-column grid | Single-column stack of cards; Capital hero first |
| 3.2 | Studio | Wide panels | Full-width card; calendar strip sticky under sub-nav |
| 3.3 | Develop | List + wide table | Card rows; tap-to-expand detail sheet |
| 3.4 | Productions | Grid of cards | 2-col masonry → 1-col, production details in sheet |
| 3.5 | Box Office | Dense chart + table | Chart full-width; table → card rows; week strip sticky |
| 3.6 | Fans | Table | Card rows |
| 3.7 | OTT & Series | Grid | 1-col rows |
| 3.8 | Live TV | Grid | 1-col rows |
| 3.9 | Empire | Wide dashboard | Stacked metric cards |
| 3.10 | Library | Grid | 1-col rows, search-first |
| 3.11 | Game Studio | Wide panels | Stacked cards |
| 3.12 | Finance | Dense table | Card rows; capital/liability chips in app bar |
| 3.13 | Notifications | List | Full-width list in sheet |

**Per-desk AC (apply to each 3.x):**
- Content fits 360px with no horizontal overflow (`overflow-x` guard).
- No element wider than the viewport (mirror `mobile-shell.css:915` guard).
- Primary action is ≥44px tap target.
- Table → card-row conversion keeps all data visible (no truncation without a tap-to-expand).

**Phase 3 exit:** `npm test` + `npm run test:rebuild` green; all 13 desks render clean at 360px.

---

## Phase 4 — A11y, polish, and the collapsible lot stage

**Goal:** Make the vertical shell feel finished and accessible. Deliverable: a11y pass, motion/contrast, and the lot-stage collapse.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| 4.1 | Landmark roles: `header`/`main`/`nav`/`button`/`dialog` correct on the shell. | `system/vertical.css`, views | Screen-reader structure passes axe/manual check. |
| 4.2 | Focus order: app bar → sub-nav → content → action bar → bottom nav. | `ui.js`, `system/vertical.css` | Tab order is logical; focus visible. |
| 4.3 | Tap-target audit: every interactive element ≥44px (retires 28px landscape buttons). | `system/vertical.css` | No interactive element under 44px in the vertical shell. |
| 4.4 | Contrast: gold-as-text vs gold-as-surface tokens applied; text meets WCAG AA on both themes. | `system/tokens.css`, `system/vertical.css` | Contrast check passes dark + light. |
| 4.5 | Reduced-motion + orientation-change handling (re-layout on rotate). | `system/vertical.css`, `mobile-shell.js` | `prefers-reduced-motion` respected; rotate re-flows. |
| 4.6 | Collapsible lot stage: tap to collapse the lot wallpaper to a 44px strip, freeing vertical space. | `ui.js`, `system/vertical.css` | Collapse/expand toggle works; content re-flows. |
| 4.7 | 360px + 414px + landscape-phone screenshots of all 13 desks. | screenshots/ | Full set captured; no clipping. |

**Phase 4 exit:** A11y + visual checks pass; collapsible lot stage ships.

---

## Phase 5 — Cleanup: retire the landscape layer

**Goal:** Remove the contradictory landscape-first artifacts so portrait is the only truth. Deliverable: net CSS reduction, no landscape-only code paths.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| 5.1 | Delete `landscape-phone.css` and its `<link>`. | `index.html` | No landscape-phone stylesheet; portrait handles landscape via enhancement. |
| 5.2 | Remove the desktop `#tabsNav` tab strip (replaced by the rail at ≥900px). | `index.html`, `style.css`, `ui.js` | Desktop shows a rail, not a duplicate tab strip. |
| 5.3 | Remove the `#fabWeek` FAB markup + rules (single CTA lives in the action bar). | `index.html`, `style.css` | No `fab-week` elements/rules remain. |
| 5.4 | Update `system/tokens.css` header comment: target is now **portrait**, not landscape. | `system/tokens.css` | Comment reflects portrait-first truth. |
| 5.5 | Verify AndroidManifest `portrait` lock matches the now portrait-first CSS. | `AndroidManifest.xml` | Orientation lock and CSS target agree. |
| 5.6 | CSS debt tally: target ≤12,500 net lines across the bundle. | all CSS | Net reduction achieved; `style-coverage` guard still passes. |

**Phase 5 exit:** Landscape-first artifacts gone; `npm test` + guards green; CSS debt reduced.

---

## Phase 6 — Unify the two builds (fold root onto the portrait shell)

**Goal:** Kill the duplicate-build split: make the root app the single portrait-first build, with `game/` retired or merged.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| 6.1 | Confirm the root app's engine + feature modules are equivalent to `game/` (feature parity audit). | both | Parity matrix: every `game/*.js` feature is present in root. |
| 6.2 | Port the root app onto the portrait shell (adopt `mobile-shell.css`/`mobile-shell.js`/`phone-ux.js` chrome on root). | root `index.html`, `system/*` | Root renders the vertical shell with no `game/` dependency. |
| 6.3 | Delete the `game/` duplicate tree (or archive it) once root is verified. | `game/` | Single source of truth; no duplicated engine. |
| 6.4 | Update `apk/build-www.js` to package the (now vertical) root build as the APK default. | `apk/build-www.js` | `npm run apk:web` packages the portrait build; APK ships portrait. |
| 6.5 | Release: version bump + full `release.sh` preflight. | `release.sh`, `version.json` | Release pipeline green; APK ships vertical-first. |

**Phase 6 exit:** One build, portrait-first, ships in the APK; duplicate eliminated.

---

## QA gates (every phase)

- `npm test` — smoke, collection-engine, ui-test, balance, scenario-playthrough, sandbox-audit, stage-division, guards.
- `npm run test:rebuild` — all 23 rebuild modules (`test:rebuild:ui` needs `puppeteer-core`, install before running the visual gate).
- `node --check` on every touched JS file.
- Manual: 360px portrait render, desktop (≥900px) render, and orientation-rotate re-flow.

## Risks

| Risk | Mitigation |
|------|------------|
| Restyling 13 desks risks data loss in table→card conversions | Per-desk AC: no truncation without tap-to-expand; `ui-test` covers rendering. |
| Deleting `landscape-phone.css` may regress landscape phones | Landscape becomes an enhancement of the vertical DOM; verify on a landscape-phone width before deletion. |
| Root/`game/` parity gaps surface late | Phase 6.1 parity audit gates the merge; keep `game/` until root is verified. |
| `test:rebuild:ui` visual gate unavailable without a browser | Install `puppeteer-core` before Phase 4 screenshots; core suite still runs. |

## Open decisions (from parent plan, must be locked before Phase 2)

- **D1** — bottom-nav labels: verb (Create/Market) vs noun (Develop/Box Office).
- **D2** — Next-Week CTA: pinned action bar vs FAB.
- **D3** — Notifications: header inbox vs a tab.
- **D4** — desktop navigation: rail (≥900px) vs tab bar.
- **D5** — same shell in landscape vs landscape-specific layout.

**Recommendation:** verb labels; action bar; header inbox; desktop rail; same shell in landscape.

## Execution order summary

```
Phase 1  Foundation (tokens + shell)      → shippable skeleton
Phase 2  Nav unification (5 destinations) → one nav model
Phase 3  Desk-by-desk migration           → all 13 desks portrait-first
Phase 4  A11y + polish + lot stage        → finished feel
Phase 5  Cleanup (retire landscape)       → CSS debt down, one truth
Phase 6  Unify builds                     → single portrait-first build
```
