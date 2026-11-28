# Box Office War — Vertical-First UI Redesign Plan

| Field | Value |
|---|---|
| **Status** | **PROPOSED — awaiting approval to start Phase 1** |
| **Author** | Senior Software Engineer + Product Designer (Agent Mode) |
| **Date** | 2026-11-23 |
| **Version** | 1.0 |
| **Branch** | `arena/5c48de05-box-office-war` |
| **Scope** | Portrait (vertical) phone UI for web + Android APK. Desktop & landscape become *derived* layouts, not the source of truth. |
| **Out of scope** | Game engine, save format, balance, art assets, new features. This is a **shell + navigation + component** redesign only. Zero gameplay changes. |

---

## TL;DR — The decision in 30 seconds

**Today the game is landscape-first with portrait bolted on.** The design system (`system/tokens.css`) literally says *"Target device is a phone in landscape (360–430px tall)"*, the Android manifest locks **portrait**, `landscape-phone.css` exists to rescue landscape phones from a desktop shell that eats 219px of a 390px-tall viewport, and the mobile portrait shell hides **8 of 13 tabs** behind a "More" sheet. Three navigation systems compete (desktop tab bar, bottom nav + sub-tab strip, per-desk `command-section-nav`), and "Next Week" exists **twice** (header button + floating FAB).

**The fix: flip the source of truth to vertical.** One portrait shell — compact top bar → sticky sub-nav → single-column scroll → pinned Next-Week action bar → 5-destination bottom nav — built as a single new CSS layer (`system/vertical.css`) on top of the existing token system. Desktop and landscape become progressive enhancements of the same DOM. No engine changes, no save changes, fully reversible behind a `data-layout="vertical"` flag.

**Cost:** ~6–8 focused PRs over 3–4 weeks. **Risk if we do nothing:** every new desk ships with three breakpoint patches and the APK (portrait-locked) keeps fighting the design system (landscape-targeted).

---

## 1. Why vertical, why now

### 1.1 The evidence (audited 2026-11-23)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| 1 | **Design system targets landscape, APK locks portrait** | `system/tokens.css` header comment: *"Target device is a phone in landscape (360–430px tall)"* vs `apk/android/app/src/main/AndroidManifest.xml:16` → `android:screenOrientation="portrait"` | The shipped APK and the design system disagree about the primary device. One of them is wrong; the manifest is what players actually get. |
| 2 | **Landscape rescue layer is a symptom, not a solution** | `landscape-phone.css` (257 lines, ~40 `!important` overrides) documents that at 844×390 *"the chrome alone consumed 219px of 390, leaving a sliver of content"* | We are spending maintenance budget shrinking desktop chrome to fit phones, instead of designing for the phone. |
| 3 | **13 top-level tabs, 71 sub-sections** | `index.html` `#tabsNav` (13 tabs) + `TAB_META` in `v31-features.js:342` (dashboard 4, studio 6, develop 7, productions 6, boxoffice 7, fans 4, ott 5, live 4, library 7, empire 6, games 7, finance 8) | No human navigates 71 destinations with a thumb. The current mobile answer — hide most of them — is why players miss features. |
| 4 | **Mobile hides 8 tabs behind "More"** | `index.html` `#bottomNav` has 5 buttons (Home/Studio/Create/Market/More); `NAV_GROUPS` in `v31-features.js:335` puts empire/library/games/finance/notifications under "More"; `ui.js:1013 moreSheet()` renders them as a modal list | "More" is a junk drawer, not navigation. Finance — a core loop — is two taps deep on the device players use most. |
| 5 | **Three competing nav systems** | (a) `#tabsNav` desktop bar, (b) `#bottomNav` + `#subTabs` mobile strip (`style.css:897`), (c) per-desk `.command-section-nav` (`command-deck.css`, 3,298 lines) | Same destination, three patterns. Users relearn navigation on every desk; engineers patch three places per change. |
| 6 | **Duplicate primary CTA** | `#btnWeek` in header (`index.html`) **and** `#fabWeek` floating button (`style.css:1125`) both advance the week on mobile | Two sources of truth for the single most important action. They can drift (labels, disabled states, analytics). |
| 7 | **Header is 2–3 rows on the smallest screens** | `style.css:897` `@media(max-width:760px)` turns `.topbar-actions` into a 7-column grid on its own line; `command-deck.css:83` stacks it vertically at ≤430px portrait | On a 360px-wide phone the header — not content — is the product. |
| 8 | **CSS is 13,643 lines across 21 files with 4 palettes** | `system/tokens.css` header admits *"~960 raw hex literals"* plus `--cd-t*`, `--ts-*`, `--bow-*` palettes; breakpoints are inconsistent (740/760/900/950/1050/1280 all in use) | Every visual change is a cascade gamble. `landscape-phone.css` needs `!important` *because* specificity is already lost. |
| 9 | **Persistent 2D lot stage eats vertical space** | `#studiolotGlobalStage` sits between header and `#view` on every tab (`index.html`) | On a tall phone this is a permanent tax on every screen, even desks that don't use the lot. |
| 10 | **Comment/manifest contradiction** | `landscape-phone.css:14` says *"the Android build is landscape-locked"* — the manifest says portrait | Documentation drift. A new contributor cannot tell which orientation is canonical. |

### 1.2 The product argument

- **The APK is the product.** `package.json` describes *"runs in any browser — phone, tablet, or PC"*, but distribution is the signed APK (`npm run apk`). Phones are held **vertically** by default; landscape is a deliberate rotation for video/2D-lot moments, not the home position.
- **Thumb zone math.** In portrait, the bottom 40% of the screen is the reachable zone. The current design puts the primary loop (Next Week) in the header (top, unreachable) and compensates with a FAB. A vertical shell puts navigation + primary action in the thumb zone by construction.
- **Content is vertical by nature.** Slate trackers, charts, news feeds, talent lists, ledger rows — every desk in `ui.js` (12,673 lines, 27 `view*` functions) renders as stacked cards/lists. The desktop multi-column grids are the adaptation; the single column is the native form.
- **Cost of delay.** Every new system (v46 added 8) ships 4–7 sub-sections. Without an IA reset, the next 8 systems make 71 sub-sections into 100+. The redesign must land *before* the next content wave, not after.

### 1.3 What "vertical-first" means (and doesn't)

- ✅ Portrait phone (360–430px wide) is the **reference viewport**. All specs, screenshots, and QA start there.
- ✅ Desktop (≥1024px) and landscape phone are **enhancements**: wider grids, side rails, denser tables — same DOM, same order, more columns.
- ❌ Not "mobile-only". Desktop keeps full functionality; it just stops being the layout everything else is squeezed from.
- ❌ Not a rewrite. Engine (`engine.js`, 80KB), save format, and all 27 view functions stay. We change **shell, nav, and CSS layering** — the layer that has caused 90% of the visual bugs.

---

## 2. Design principles

These are the tie-breakers for every decision below. If a proposal violates one, it loses.

| # | Principle | What it means in practice |
|---|---|---|
| P1 | **Thumb-first** | Primary actions and navigation live in the bottom 40%. Nothing critical requires reaching the top-right corner. |
| P2 | **One screen, one job** | Each desk answers one question ("Can I afford this film?", "Is my slate on track?"). Secondary info collapses into `<details>`/sheets, never a second column on phone. |
| P3 | **Progressive disclosure** | 71 sub-sections become reachable in ≤2 taps, but only ~5 are visible at once. Depth is fine; *visible* depth is not. |
| P4 | **One nav, everywhere** | Bottom nav + sticky sub-nav is the *only* section navigation. Per-desk `command-section-nav` is migrated into it, not duplicated. |
| P5 | **Tokens, never literals** | No raw hex, no ad-hoc px. Everything references `system/tokens.css` semantic tokens. New components cannot introduce a new palette. |
| P6 | **44px or it didn't happen** | WCAG 2.2 target size AA (44×44 CSS px minimum, 48 preferred for primary). Landscape-phone's 28px buttons are explicitly retired. |
| P7 | **No duplicate CTAs** | One Next-Week control. One inbox. One settings entry. If two buttons do the same thing, one is deleted. |
| P8 | **Reversible by flag** | The entire redesign ships behind `data-layout="vertical"` on `<html>`. Any regression = flip the flag, ship the fix, no rollback PR. |

---

## 3. Target devices & breakpoints

### 3.1 Reference viewports (QA order)

| Priority | Viewport | Device class | Layout |
|---|---|---|---|
| **P0** | 360×800, 390×844, 412×915 | Android portrait (APK primary) | Vertical shell, single column |
| **P0** | 360×640 (small) | Budget Android portrait | Vertical shell, compact density |
| **P1** | 768×1024, 820×1180 | Tablet portrait | Vertical shell, 2-col grids where safe |
| **P1** | 844×390, 740×360 | Phone landscape | Vertical shell, condensed header, lot stage expanded |
| **P2** | 1280×800, 1440×900 | Desktop | Vertical shell + rail/grid enhancement |
| **P2** | 1024×768 | Tablet landscape | Hybrid: bottom nav retained, grids widen |

### 3.2 Breakpoint strategy (replaces the current 740/760/900/950/1050/1280 sprawl)

```css
/* system/vertical.css — the ONLY new breakpoint set. Legacy files keep theirs
   until migrated, then their queries are deleted. */
--bp-xs: 360px;   /* minimum supported width */
--bp-sm: 600px;   /* large phones / small tablets: 2-col grids unlock */
--bp-md: 900px;   /* tablets: rail + content */
--bp-lg: 1200px;  /* desktop: full command-deck grids */
```

Rules:
- **Mobile-first, `min-width` only** in the new layer. No `max-width` chains, no orientation queries except the lot-stage enhancement.
- Orientation is **never** a layout switch. Landscape gets the same vertical shell with a shorter header and an expanded lot stage — not a different app.
- `env(safe-area-inset-*)` on every fixed bar. Notch/gesture-nav devices are P0, not an afterthought.

---

## 4. New information architecture

### 4.1 The problem with the current IA

`NAV_GROUPS` (`v31-features.js:335`) is unbalanced and mislabeled:

```
Home    → dashboard                                  (1 tab)
Studio  → studio                                     (1 tab)
Create  → develop, productions                       (2 tabs)
Market  → boxoffice, fans, ott, live                 (4 tabs)
More    → empire, library, games, finance, notifications  (5 tabs) ← junk drawer
```

"More" contains Finance (core loop), Library (core loop), and Notifications (should be a header inbox, not a tab). Meanwhile Studio has one tab and Market has four. The desktop bar shows all 13; mobile shows 5 + a modal. **Same game, two IAs.**

### 4.2 Proposed IA — 5 destinations, no "More"

| Bottom nav | Contains (tabs) | Player question it answers | Sub-nav (sticky chips) |
|---|---|---|---|
| **Home** 🏠 | `dashboard` | "Where am I, what needs me?" | Command deck · Desks · Slate · Pulse |
| **Create** ✍️ | `develop`, `productions` | "What am I making?" | Scripts · Pitch · Audience · Craft · Rights · Talent · Combos · Locations **/** All · Pre · Shoot · Post · Ready · Dated |
| **Market** 📈 | `boxoffice`, `fans`, `ott`, `live` | "How is it selling?" | Chart · Chains · PLF · Blitz · Territories · Awards · Clash **/** Mail · Trending · Viral **/** Home · Originals · Deals · Sports · Market **/** Linear · Stream · Events · Studio |
| **Studio** 🏢 | `studio`, `empire`, `library` | "What do I own?" | Campus · Leadership · Strategy · Workforce · Reputation · Legacy **/** Franchises · Universes · Divisions · Stage · Endgame **/** Overview · Films · Series · Rights · Catalogue · Physical · Restoration |
| **Business** 💼 | `games`, `finance` | "How do I fund & grow?" | Overview · Develop · Catalog · Studio · Contracts · Awards · Hardware **/** Ledger · Capital · Forecast · Equity · M&A · Analysis · Board · Invest |

**Changes from today:**
1. **"More" is deleted.** Its 5 tabs are promoted into Studio/Business. No destination is ever behind a modal.
2. **Notifications leaves the tab bar** → header inbox button with badge (it already has `#btnBell` + `#bellBadge`; the tab is redundant).
3. **Create absorbs Productions** (already grouped in `NAV_GROUPS`; the desktop bar separates them, the mobile shell already merges them — we make the IA honest).
4. **Studio absorbs Empire + Library** ("what do I own" — campus, franchises, catalogue are one mental model).
5. **Business = Games + Finance** (both are "deploy capital for growth"; Finance is promoted from the junk drawer to a first-class destination).

> **Designer note:** Labels use verbs/nouns players say ("Create", "Market"), not department names ("Develop", "Box Office"). Icons are required on all 5 (today's bottom nav is text-only emoji-less buttons — see §7.6).

### 4.3 Navigation depth budget

| Depth | Pattern | Example |
|---|---|---|
| 0 | Bottom nav (5 destinations) | Tap **Market** |
| 1 | Sticky sub-nav chips (≤8 per tab) | Tap **Blitz** |
| 2 | In-desk section nav *or* bottom sheet | Blitz ladder, talent filters |
| 3 | Modal / full-screen sheet | Film detail, contract signing |

**Rule:** No feature may require >3 taps from Home. Today, Finance → M&A Vault is: More → Finance → M&A (3 taps *plus* a modal). After: Business → M&A (2 taps). Every desk gets a tap-count audit in Phase 3.

### 4.4 What happens to the desktop tab bar?

`#tabsNav` (13 tabs) is **hidden in vertical mode** and replaced by the bottom nav + sub-nav at *all* widths. At ≥900px the sub-nav becomes a left rail (same component, horizontal → vertical). This deletes the "two IAs" problem: one nav model, two presentations. Desktop users lose nothing — the rail shows the same 5 destinations + sub-sections.

---

## 5. The vertical shell — layout specification

### 5.1 Anatomy (portrait phone, top → bottom)

```
┌─────────────────────────────────────────┐  ← safe-area-top
│ [BW] Studio Name        $12.4M  Y3·W12  │  App bar (56px) — §5.2
│      CAPITAL · STANDING · INBOX · ⚙     │
├─────────────────────────────────────────┤
│ [Scripts][Pitch][Audience][Craft]···    │  Sticky sub-nav (44px) — §5.3
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │  LOT STAGE (collapsible, 160px)     │ │  Hero — §5.4
│ │  [tap to expand]                    │ │
│ └─────────────────────────────────────┘ │
│                                         │
│  ┌─ Card ────────────────────────────┐  │  Content scroll
│  │  Title            $ value         │  │  (single column,
│  │  ─────────────────────            │  │   16px gutters)
│  │  Body / chart / list              │  │
│  └───────────────────────────────────┘  │
│  ┌─ Card ────────────────────────────┐  │
│  │  ...                              │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│ [ Next Week  → ]  [+4W] [Auto]          │  Action bar (64px) — §5.5
├─────────────────────────────────────────┤
│ 🏠    ✍️    📈    🏢    💼              │  Bottom nav (64px) — §5.6
│ Home Create Market Studio Business      │  + safe-area-bottom
└─────────────────────────────────────────┘
```

Total fixed chrome: **56 + 44 + 64 + 64 = 228px** on a 800px-tall phone → **572px of content** (vs. today's header+tabs+subtabs+FAB stack which exceeds 200px *before* the lot stage). On a 640px-tall small phone: 412px content. Acceptable; the lot stage collapses to 0px when not relevant (§5.4).

### 5.2 App bar (replaces `.topbar-row` + `.command-header-row`)

| Element | Spec | Notes |
|---|---|---|
| Height | 56px (52px compact ≤360px wide) | Replaces current 2-row stack |
| Left | `BW` mark (32px) + studio name (15px semibold, ellipsis) | Eyebrow text deleted on phone (today's `.command-header-eyebrow` is hidden at ≤740px anyway — formalize it) |
| Center/right | **Capital** chip (tappable → Finance) + **Date** chip (tappable → calendar) | Debt + Standing move *into* the Finance desk; they are not glanceable-critical. Today landscape hides them too (`landscape-phone.css` hides chips 2–3) — we agree, permanently. |
| Right | Inbox (bell + badge) · Settings (gear) | Sound + Field Guide move into Settings/More sheet. Help is already reachable from More today (`landscape-phone.css` hides `#btnHelp` for this reason). |
| Time controls | **Removed from header** | Next Week lives in the action bar (§5.5). One CTA (P7). |

### 5.3 Sticky sub-nav (replaces `#subTabs` + `.command-section-nav`)

- **One component**, rendered by extending `renderSubTabs()` (`ui.js:2100`) to cover *all* tabs (today it early-returns for 11 of 13 tabs and lets each desk render its own nav — the root of the 3-nav problem).
- Sticky under app bar (`position: sticky; top: 56px`), horizontal scroll with edge fade (pattern already proven in `landscape-phone.css` `#tabsNav` mask).
- Chips: 36px min-height, 13px/600, active = gold fill + dark ink (reuse `.stab.active` from `style.css:913`).
- At ≥900px: becomes a **left rail** (200px, vertical list, same buttons). No second component.
- Per-desk `.command-section-nav` instances are **deleted** as desks migrate (Phase 3). Their tools (e.g. Develop's Agency/Contracts buttons) move into a "Tools" overflow chip or the desk header — never a second nav row.

### 5.4 Lot stage (replaces `#studiolotGlobalStage` always-on)

| State | Height | Behavior |
|---|---|---|
| Collapsed (default) | 0px (hidden) | Shown only on Studio tab + Dashboard hero |
| Peek | 160px | Tappable → expands to 320px; swipe down collapses |
| Expanded | 320px / 40vh | Full 2D lot interaction; content scrolls below |

Rationale: the lot is a *destination* (Studio → Campus), not wallpaper. Today it taxes every desk. Dashboard keeps a 160px peek as the visual anchor; all other desks get the space back.

### 5.5 Action bar (replaces `#btnWeek` + `#fabWeek` duplication)

```
┌──────────────────────────────────────────────┐
│ [  Next Week  →  ]  [+4W]  [▶ Auto]          │  64px, gold primary
└──────────────────────────────────────────────┘
```

- **Next Week** = full-width-flex primary (gold gradient, 48px, 15px/800). This is `#btnWeek` moved, `#fabWeek` deleted. One control, one handler, one analytics event.
- **+4W / Auto** = secondary icon buttons (48px). Speed toggle (`#btnSpeed`) joins Auto as a long-press / overflow — it is hidden today (`style="display:none"`) and should stay that way on phone.
- Pinned above bottom nav, `backdrop-filter: blur`, safe-area aware. Week-summary modal (`wk-head`/`wk-cash`) unchanged — it already works as a sheet.
- Desktop (≥900px): action bar becomes a header-anchored control again (space is free), FAB stays deleted everywhere.

### 5.6 Bottom nav (replaces `#bottomNav` text-only buttons)

| Spec | Value |
|---|---|
| Destinations | 5 (§4.2), each icon (24px) + label (10px/700) |
| Height | 64px + safe-area-bottom |
| Active state | Gold icon + label, 2.5px top indicator (reuse `.btab.active::before` from `style.css:951`) |
| Badges | Inbox badge on Home (unread count); Finance alert dot on Business (debt warning) — *new*, cheap, high-value |
| Icons | Inline SVG sprite (extend the existing sprite referenced in README v43.2 notes). **No emoji as nav icons** — emoji render inconsistently across Android OEMs and break the token system. |

### 5.7 Content area

- Single column, 16px gutters, max-width 640px centered on phone (readable line length for cards), 1060px on desktop (existing `.view` max-width — keep).
- Bottom padding = action bar + bottom nav + safe area (today's `calc(124px + env(...))` in `style.css:897` — formalize as `--chrome-bottom` token).
- Cards stack with 12px gaps; 2-col grids unlock at ≥600px only for *peer* items (talent cards, script cards), never for sequential flows (wizard steps stay 1-col).

---

## 6. Component specifications

All components reference semantic tokens (`--surface-*`, `--text-*`, `--accent`, `--line-*`). No new colors. Type scale from `system/tokens.css` §4 (verify values in Phase 1; the scale exists, it is just not enforced).

### 6.1 Cards (`.card`, `.stat`, `.develop-script`, …)

| Token | Value | Notes |
|---|---|---|
| Radius | 14px (`--r-md`) | Kill the 10/11/12/14/20px sprawl |
| Padding | 16px phone / 20px desktop | Today: 12–18px ad hoc |
| Border | 1px `--line-1` | Hover/focus: `--line-3` |
| Elevation | `--shadow-sm` resting, `--shadow` on press | No glow except primary CTA |
| Title | 15px/700 `--text-1` | Eyebrow 10px/800 `--text-3` uppercase, 0.08em tracking |

### 6.2 Lists & rows (`.film-row`, `.calendar-row`, `.news-item`, `.talent-card`)

- Row min-height **56px** (today's `.calendar-row` is ~44px; `.news-item` ~40px — both fail P6).
- Primary line 14px/600, secondary 12px `--text-2`, trailing value 14px/800 tabular-nums.
- Dividers: 1px `--line-1`, inset 16px. No card-per-row on phone (today's `.pick-list .card` per item wastes 30% of vertical space) — rows, not cards, for lists >4 items.

### 6.3 Charts (`.chart-bar`, `.weekly-gross-chart`, `.forecast-bars`, `.stock-spark`)

- Bars: min touch target via invisible padding; value labels 11px tabular-nums *outside* bars on phone (today's inside-fill labels clip at 360px — `style.css` already patches this at ≤760px, formalize it).
- Weekly gross chart: horizontal scroll-snap on phone if >12 bars, fixed on desktop.
- All charts: `role="img"` + `aria-label` with the key figure (today's bars are divs with no text alternative — accessibility gap, §8).

### 6.4 Modals → bottom sheets

- Phone: **bottom sheet** (full-width, 92vh max, drag handle, swipe-down to dismiss, safe-area padding). The `.modal` in `style.css:897` already goes bottom-sheet-ish at ≤760px (`border-radius:22px 22px 0 0`) — promote to the *only* pattern.
- Desktop: centered dialog (existing behavior).
- Sheet header: 18px/800 title + close (44px). Actions: sticky footer, primary full-width on phone.
- Focus trap + `Esc` + backdrop tap. Today modals vary per desk — one `openSheet()` helper in Phase 2.

### 6.5 Forms & wizard (Develop pitch flow)

- Inputs: 48px height, 16px font (prevents iOS/Android zoom-on-focus), `--surface-4` fill, `--line-2` border, gold focus ring (existing `:focus-visible` in `design-tokens.css`).
- Wizard steps (`.wiz-step`): sticky under sub-nav, numbered, tappable to go back. Today they scroll away — on a 640px-tall phone the user loses their place mid-pitch.
- Sliders (`.slider-row`): 44px track hit area (today 36px), value readout always visible (today it is, keep).

### 6.6 Buttons

| Variant | Height | Padding | Font | Usage |
|---|---|---|---|---|
| Primary (gold) | 48px | 16px | 15px/800 | Next Week, Greenlight, Launch |
| Secondary (outline) | 44px | 14px | 14px/700 | Cancel, secondary actions |
| Ghost | 44px | 12px | 14px/600 | Tertiary, sub-nav overflow |
| Icon | 44×44px | — | 20px SVG | Bell, gear, close |

The 44px floor is already enforced by `#app button { min-height:44px !important }` (per `landscape-phone.css` comment) — the redesign *keeps* it and deletes the landscape overrides that violate it.

### 6.7 Tables (Finance ledger, Library catalogue)

- Phone: **card-rows**, not `<table>`. Each row = 2–3 key fields + chevron → detail sheet. Tables at 360px are unreadable; the Finance desk already struggles here.
- Desktop (≥900px): real tables return (same data, `display: table` enhancement).
- Numbers: `font-variant-numeric: tabular-nums` everywhere (already used in `.stat .s-v` — extend to all figures).

### 6.8 Toasts, banners, empty states

- Toasts: bottom-anchored above action bar (today `.toasts` is bottom:10px — it collides with the FAB; after FAB deletion, anchor to `--chrome-bottom`).
- Offline banner (`#offlineBanner`): keep, restyle to token colors (today inline styles).
- Empty states: one pattern (icon + 15px title + 13px body + primary action). Today each desk invents its own (`.command-empty`, etc.) — consolidate in Phase 3.

---

## 7. Visual system

### 7.1 Tokens — reuse, don't reinvent

`system/tokens.css` is already the right foundation (graphite neutrals + brass gold, semantic layer, legacy aliases). The redesign **does not** introduce a new palette. Phase 1 work:

1. **Verify & complete the scale** — type (11/12.5/14/16/20/26/34/48), space (4pt grid), radius (6/10/14/20/28/full), elevation, motion. Fill gaps; delete duplicates in `design-tokens.css` (v30) by pointing its aliases at the system tokens (the alias layer already exists — finish the job).
2. **Add 4 vertical-shell tokens** (the only additions):
   ```css
   --chrome-top: 56px;        /* app bar */
   --chrome-subnav: 44px;     /* sticky sub-nav */
   --chrome-action: 64px;     /* Next Week bar */
   --chrome-bottom: calc(64px + var(--chrome-action) + env(safe-area-inset-bottom));
   ```
3. **Delete raw hex on touch** — audit `command-deck.css` + `style.css` for literals introduced during desk migrations; replace with tokens. Target: zero hex outside `system/tokens.css` + `legacy-map.css`.

### 7.2 Typography

| Role | Size / Weight | Notes |
|---|---|---|
| Display (desk hero) | 26px/800 | Desktop 34px. Today `.command-heading h1` varies 27–30px per breakpoint — lock it. |
| Title (card) | 15px/700 | |
| Body | 14px/400–500 | 14.5px on phone today (`style.css:897`) — standardize to 14px for density |
| Caption / eyebrow | 10–11px/700–800 uppercase | Tracking 0.08em |
| Figure (money, scores) | 17–21px/800 tabular-nums | `.stat .s-v` pattern, everywhere |

Font stacks stay (`Inter`/`Outfit`/`JetBrains Mono` via `design-tokens.css`). No webfont downloads — offline-first (PWA + APK) forbids it.

### 7.3 Color & contrast

- Graphite `#08090b` base + brass `#e8b44a` accent (system tokens) — keep. It already reads "cinema" without neon.
- **Contrast audit required (Phase 1):** `--text-3` (`#6b7482` on `#08090b`) is ~4.6:1 — passes AA for large text, borderline for 10px eyebrows. Eyebrows must use `--text-2` (`#9aa2af`, ~7:1) or bump to 11px. Gold-on-dark for body text is banned (accent-ink `#241a05` on gold only).
- Semantic washes (`.success-wash` etc.) for status — already in tokens, enforce usage.

### 7.4 Iconography

- Inline SVG sprite, 24px grid, 2px stroke, round caps. Extend the existing sprite; do not add an icon font or emoji nav.
- Every icon button gets `aria-label` (today `#btnSound`/`#btnSettings` have them — audit the 40+ desk-level icon buttons for the same).

### 7.5 Motion

| Token | Value | Usage |
|---|---|---|
| `--fast` | 120ms | Press states, chip toggles |
| `--normal` | 200ms | Sheet open/close, tab transitions |
| `--slow` | 320ms | View enter (existing `viewIn` 0.32s — keep) |
| `--spring` | 320ms cubic-bezier(.34,1.56,.64,1) | Bottom-nav active icon (existing) |

- `prefers-reduced-motion`: already handled in 3 places (`design-tokens.css`, `style.css:1156`, `command-deck.css:899`) — consolidate to one rule in `vertical.css`, keep the `body.rm-motion` class hook (settings toggle depends on it).
- FAB pulse animation dies with the FAB. No infinite animations on phone (battery).

---

## 8. Accessibility, i18n & offline

| Area | Requirement | Current state → Target |
|---|---|---|
| Target size | 44×44px min (WCAG 2.2 AA 2.5.8) | Enforced globally → keep, delete landscape 28px overrides |
| Focus | Visible gold ring, logical order, focus trap in sheets | `:focus-visible` exists → extend to sub-nav chips + bottom nav |
| Screen reader | Nav landmarks, `aria-current="page"` on active destination, chart text alternatives | Partial (`aria-label` on navs) → add `aria-current`, chart labels, sheet `role="dialog"` |
| Contrast | 4.5:1 body, 3:1 large/UI | Audit in Phase 1 (§7.3) |
| RTL | `dir="rtl"` mirroring (already in `style.css:2378` for bottomnav/subtabs/FAB) | Keep + extend to action bar + rail. Test with Arabic/Hebrew locale. |
| i18n | `i18n.js` strings, no hardcoded labels in new shell | New shell strings go through `i18n.js` from day one |
| Reduced motion | One consolidated rule + settings toggle | Consolidate (§7.5) |
| Offline | PWA (`sw.js`) + APK, zero network fonts/images | No change. New CSS is one file, cache-busted with `?v=` like the rest. |
| Zoom | 200% text resize without horizontal scroll | Single-column layout passes by construction; verify in QA matrix |

---

## 9. Technical architecture

### 9.1 CSS strategy — one new layer, old layers on a diet

```
Load order (index.html <head>):
  design-tokens.css      → aliases only (frozen)
  style.css              → legacy base (frozen, then shrunk)
  ui-v33.css, lot-*.css  → desk styles (migrated desk-by-desk)
  command-deck.css       → desk styles (migrated desk-by-desk)
  system/tokens.css      → source of truth (kept)
  system/legacy-map.css  → alias bridge (kept)
  system/components.css  → shared components (extended)
  system/game-ui.css     → skin (kept, tokenized)
  system/vertical.css    → NEW: shell + nav + responsive (loaded last, wins)
```

- `vertical.css` is **additive first** (new selectors, `data-layout="vertical"` scope), **subtractive later** (delete overridden legacy rules per desk as it migrates). No big-bang CSS rewrite.
- `landscape-phone.css` is **deprecated, not deleted** in Phase 1: its rules move into `vertical.css` as the landscape enhancement, then the file is removed in Phase 5. Its `!important` flags are the migration checklist — each one marks a legacy rule that must be restructured.
- Specificity discipline: new layer uses single-class selectors + `[data-layout]` scope. No ID selectors, no `!important` in new code. (The `!important` arms race documented in `landscape-phone.css` is the anti-pattern.)

### 9.2 DOM changes (minimal, surgical)

| File | Change | Size |
|---|---|---|
| `index.html` | Add `data-layout="vertical"` to `<html>`; restructure `#app` header into app bar + sub-nav + action bar; add SVG sprite; delete `#fabWeek`, `#tabsNav` (kept in DOM, hidden, until Phase 5) | ~80 lines |
| `ui.js` | Extend `renderSubTabs()` to all tabs; rewrite `switchTab()` bottom-nav sync (`ui.js:896`); add `openSheet()` helper; delete `moreSheet()` (`ui.js:1013`) | ~150 lines changed |
| `v31-features.js` | Update `NAV_GROUPS` to §4.2; `TAB_META` unchanged (sub-sections stay, presentation changes) | ~10 lines |
| `system/vertical.css` | **New file** — shell, nav, components, responsive | ~900 lines |
| Desk CSS (`command-deck.css`, `style.css`, …) | Per-desk migration: delete breakpoint overrides, convert grids to single-col base + `min-width` enhancement | Net **−800 to −1,200 lines** over all phases |

**No changes to:** `engine.js`, `data.js`, save/load, `sw.js`, `apk/` (except manifest comment fix, §11), any `view*()` render logic beyond nav hooks.

### 9.3 JavaScript notes

- `renderSubTabs()` early-return (`ui.js:2113`) is the key unlock: today 11 tabs bypass it. Phase 2 removes the early-return and lets the shell own sub-nav for every tab. Desks that render `.command-section-nav` keep working until their migration PR deletes it — no flag day.
- `switchTab()` (`ui.js:853`) already handles `more` as a sheet trigger. Phase 2 deletes that branch; `moreSheet()` becomes dead code → delete in Phase 5.
- Scroll restoration (`TAB_SCROLL`, `v31-features.js:910`) is preserved — sub-nav is sticky, content scrolls underneath, per-tab scroll positions still work.
- Analytics: single `nextWeek` event from the action bar (replaces two). Verify no double-firing in QA.

### 9.4 Performance budget

| Metric | Budget | How |
|---|---|---|
| CSS total | ≤ current 13,643 lines (net negative by Phase 5) | Migration deletes more than it adds |
| First paint (APK, cold) | No regression | One extra CSS file (~900 lines, ~25KB) — negligible vs. 60+ JS files |
| Scroll FPS | 60fps on Pixel 6-class | `backdrop-filter` only on fixed bars (4 elements), `transform`/`opacity` animations only |
| Memory | No new listeners per render | Sub-nav rendered once per tab switch (existing pattern) |

---

## 10. Migration plan (phased, each phase shippable)

> **Rule:** Every phase ends with `npm test` green + APK smoke test. No phase breaks the previous one. The flag (`data-layout="vertical"`) can be flipped off at any point to ship the legacy shell.

### Phase 0 — Audit & freeze (2–3 days) ✅ *this document*

- [x] Audit current shell, nav, CSS, breakpoints (this doc, §1.1)
- [ ] Contrast + target-size audit (§7.3, §8) — produce a fix list
- [ ] Screenshot baseline: 360/390/768/1280 × all 13 tabs (for before/after)
- [ ] **Decision gate:** approve IA (§4.2) + shell (§5) or amend

**Exit criteria:** This plan approved; baseline screenshots archived.

### Phase 1 — Tokens & shell skeleton (1 week)

- `system/vertical.css`: shell grid, app bar, action bar, bottom nav, chrome tokens (§7.1)
- `index.html`: new shell DOM behind flag; SVG sprite; FAB + header time-controls hidden in vertical mode
- `system/tokens.css`: complete type/space scales; fix `--text-3` eyebrow contrast
- Fix manifest/comment contradiction (§1.1 #10): manifest stays `portrait`, `landscape-phone.css` comment corrected

**Exit criteria:** Empty vertical shell renders at 360px; `npm test` green; no visual change when flag is off.

### Phase 2 — Navigation unification (1 week)

- Extend `renderSubTabs()` to all tabs; sticky sub-nav; left rail at ≥900px
- New `NAV_GROUPS` (§4.2); bottom nav with icons + badges; delete `moreSheet()` path
- Notifications tab → header inbox (tab button removed, view kept as sheet/route)
- `openSheet()` helper; modals become bottom sheets on phone

**Exit criteria:** All 13 tabs reachable via bottom nav + sub-nav in ≤2 taps; tap-count audit passes (§4.3); `npm test` + `test:rehome` green.

### Phase 3 — Desk-by-desk migration (1–2 weeks, parallelizable)

Order by traffic × pain (Dashboard first — it's the landing screen):

| Order | Desk | Key work |
|---|---|---|
| 1 | Dashboard | Single-col command deck, lot peek (§5.4), slate tracker rows |
| 2 | Develop + Productions | Wizard sticky steps, script/talent rows, delete `.command-develop-nav` |
| 3 | Box Office + Fans | Chart labels, clash radar rows, mail filters |
| 4 | Studio + Empire + Library | Campus grid → vertical list, catalogue card-rows |
| 5 | OTT + Live | EPG rows, stream hub cards |
| 6 | Games + Finance | Ledger card-rows, M&A vault sheets |

Each desk PR: delete its breakpoint overrides, convert grids, verify at 360/390/768/1280, screenshot diff vs. baseline.

**Exit criteria:** All desks render single-column at 360px with 44px targets; per-desk `.command-section-nav` deleted; CSS net-negative.

### Phase 4 — Polish & accessibility (3–4 days)

- Motion consolidation (§7.5), focus order, chart text alternatives, RTL pass
- Empty states, toasts, offline banner tokenized (§6.8)
- 200% zoom + screen-reader (TalkBack/VoiceOver) smoke pass

**Exit criteria:** Accessibility checklist (§8) signed off; no `!important` in `vertical.css`.

### Phase 5 — Cleanup & ship (2–3 days)

- Delete `landscape-phone.css`, `#tabsNav`, `#fabWeek`, `moreSheet()`, legacy breakpoint blocks
- Remove `data-layout` flag (vertical is the only layout); update `system/tokens.css` header comment (landscape → vertical target)
- Version bump, `npm run apk`, release notes

**Exit criteria:** `npm test` + `test:all` green; APK installs over v47.2 without save loss; CSS ≤ 12,500 lines.

### Rollback plan

Any phase can be reverted by removing `data-layout="vertical"` (one attribute) — legacy CSS is untouched until Phase 5. Phase 5 ships only after a full release cycle of vertical in production.

---

## 11. File-by-file change list

| File | Phase | Change | Risk |
|---|---|---|---|
| `docs/VERTICAL-UI-REDESIGN-PLAN.md` | 0 | **This document** | None |
| `system/vertical.css` | 1–4 | **New** — shell, nav, components, responsive | Low (additive, flagged) |
| `index.html` | 1–2, 5 | Shell DOM, sprite, delete FAB/tabsNav | Medium (touch carefully, test all tabs) |
| `ui.js` | 2 | `renderSubTabs`, `switchTab`, `openSheet`, delete `moreSheet` | Medium (nav is load-bearing — full test suite) |
| `v31-features.js` | 2 | `NAV_GROUPS` update | Low (data only) |
| `system/tokens.css` | 1 | Scale completion, contrast fix, header comment | Low |
| `command-deck.css` | 3 | Per-desk migration, net deletion | Medium (largest file — migrate desk-by-desk, never wholesale) |
| `style.css` | 1–5 | Shell rules superseded, breakpoint cleanup | Medium |
| `landscape-phone.css` | 5 | **Delete** (rules absorbed into `vertical.css`) | Low (after Phase 3) |
| `apk/android/.../AndroidManifest.xml` | 1 | Comment only — confirm `portrait` is intentional | None |
| `test/` | 2–5 | Add viewport tests (360/390/768/1280 render smoke), tap-count test | Low |

**Explicitly untouched:** `engine.js`, `data.js`, `sw.js`, save format, all game-balance code, all art assets.

---

## 12. Testing & QA

### 12.1 Automated (existing suite must stay green)

```bash
npm test                    # smoke + collection + UI + balance + scenarios + guards
npm run test:all            # + lot tests + arcs
npm run test:rehome         # nav rehoming (directly affected by §4.2)
npm run test:management     # command-deck tests (directly affected by §5.3)
```

New tests to add (Phase 2):
- `test/vertical-shell.mjs` — renders all 13 tabs at 360px, asserts: bottom nav visible, sub-nav non-empty, no horizontal overflow, no `NaN`/`undefined` (extends `wiring-integration` pattern).
- `test/tap-count.mjs` — asserts every `TAB_META` sub-section is ≤2 taps from Home via `NAV_GROUPS`.

### 12.2 Manual QA matrix (per phase, minimum)

| Viewport | Tabs | Checks |
|---|---|---|
| 360×800 (Pixel 6) | All 13 | Nav, sub-nav, Next Week, sheets, wizard, charts, 44px targets |
| 390×844 (iPhone 14) | Home, Create, Market, Business | Safe areas (notch), sheet drag, RTL spot-check |
| 768×1024 (iPad) | All 13 | Rail layout, 2-col grids, lot stage |
| 844×390 (landscape) | Home, Studio | Condensed header, expanded lot, no overlap |
| 1280×800 (desktop) | All 13 | Rail + grids, tables, keyboard nav |
| 360×640 (small) | Home, Develop | Compact density, no clipped CTAs |

### 12.3 Device checks

- [ ] APK cold start → Resume Studio → Next Week ×3 (no double-fire, week summary correct)
- [ ] Airplane mode → full session offline (PWA cache + APK assets)
- [ ] Save → update APK → save loads (no migration needed — no save changes)
- [ ] TalkBack (Android) + VoiceOver (iOS web) → navigate all 5 destinations

---

## 13. Risks, trade-offs & open decisions

### 13.1 Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `command-deck.css` (3,298 lines) resists migration — desk-specific overrides break | **High** | Migrate desk-by-desk (Phase 3), never wholesale. Each desk PR is independently revertible. |
| Sub-nav unification breaks a desk's custom nav logic (e.g. Develop tools, Finance `data-finsub`) | Medium | Phase 2 keeps desk navs working; deletion happens per-desk in Phase 3 after verification. |
| Desktop users revolt at losing the 13-tab bar | Low | Rail at ≥900px shows identical destinations; desktop is P2, phone is P0. Monitor feedback post-Phase 2. |
| Scope creep — "while we're here, redesign X" | Medium | This plan is shell-only. New features wait for Phase 5. Any addition needs a plan amendment. |
| CSS cascade surprises from 21 files | Medium | Additive-first + flag (§9.1). Screenshot diffs per desk catch regressions. |

### 13.2 Trade-offs accepted

| Trade-off | We accept | Because |
|---|---|---|
| Debt/Standing leave the header | Glanceability ↓, header clarity ↑↑ | Finance desk is one tap away (Business); landscape already hides them |
| Lot stage not always visible | Ambient charm ↓, content space ↑↑ | Lot is a destination, not wallpaper (§5.4) |
| Desktop loses horizontal tab bar | Familiarity ↓, consistency ↑↑ | One IA everywhere (§4.4); rail preserves function |
| "More" sheet deleted | Power users lose a shortcut | Every destination is now ≤2 taps; sheets are for *actions*, not navigation |

### 13.3 Open decisions (need owner sign-off at Phase 0 gate)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Bottom-nav labels: verbs vs. departments | "Create/Market" vs. "Develop/Box Office" | **Verbs** (§4.2) — matches player language, shorter for 360px |
| D2 | Next Week placement: action bar vs. FAB | Action bar (proposed) vs. keep FAB | **Action bar** — discoverable, single CTA (P7) |
| D3 | Notifications: header inbox vs. tab | Inbox (proposed) vs. keep tab | **Inbox** — badge + sheet, frees a nav slot |
| D4 | Desktop rail vs. top tabs | Rail (proposed) vs. keep `#tabsNav` | **Rail** — one nav model (§4.4) |
| D5 | Landscape phone: same shell vs. special case | Same shell (proposed) vs. keep `landscape-phone.css` | **Same shell** — orientation is not a layout switch (§3.2) |

---

## 14. Success metrics

| Metric | Baseline (today) | Target (Phase 5) | How measured |
|---|---|---|---|
| Taps Home → any sub-section | 3–4 (via More) | ≤2 | `test/tap-count.mjs` |
| Fixed chrome on 360×800 | ~200px+ (header stack + FAB) | 228px *total incl. nav* with 572px content | Screenshot audit |
| Touch targets <44px | Landscape 28px buttons, 36px chips | 0 | Automated audit (computed styles at 360px) |
| CSS lines | 13,643 | ≤12,500 | `wc -l` |
| `!important` in new code | ~40 in `landscape-phone.css` alone | 0 in `vertical.css` | `grep -c '!important'` |
| Nav systems | 3 | 1 | Code review |
| Duplicate CTAs | 2 (header + FAB) | 1 | Code review |
| `npm test` | Green | Green (every phase) | CI |

---

## Appendix A — Screen-by-screen migration notes

| Tab | Current pain | Vertical treatment |
|---|---|---|
| **Dashboard** | Command deck assumes wide grids; lot stage + header stack | Single-col deck, lot peek, slate tracker as rows, inbox summary card |
| **Studio** | Campus grid (`.command-campus`) is landscape-first | Campus → vertical directory list; lot expanded here by default |
| **Develop** | Own nav (`.command-develop-nav`) + wizard steps scroll away | Shell sub-nav replaces desk nav; sticky wizard steps; script cards → rows |
| **Productions** | Phase bars + calendar rows cramped at 360px | Phase tracker as vertical stepper; calendar rows 56px |
| **Box Office** | Chart labels clip; clash radar dense | Labels outside bars; radar as ranked rows |
| **Fans** | Mail filters + viral cards | Filter chips in sub-nav; viral as feed rows |
| **OTT / Live** | EPG grids, stream hub cards | EPG as timeline rows; hub as stacked cards |
| **Empire** | Franchise/universe grids | Horizontal snap-scroll carousels (peer items only) |
| **Library** | Catalogue tables unreadable at 360px | Card-rows + detail sheet (§6.7) |
| **Games** | 7 sub-sections, hardware tables | Sub-nav chips; tables → rows |
| **Finance** | Ledger tables, M&A modals, no mobile sub-nav (fixed v38) | Ledger card-rows; M&A as sheets; Business destination (§4.2) |

## Appendix B — Wireframes (text)

**B.1 Home (360px)**
```
App bar: [BW] Lighthouse Pictures        $12.4M  Y3·W12  🔔 ⚙
Sub-nav: [Command deck][Desks][Slate][Pulse]
Lot peek (160px, tap to expand)
Card: WEEK 12 SUMMARY — Cash +$2.1M, Slate 3 active, 1 premiere in 2w
Card: SLATE TRACKER — rows: Film A (Shoot, 62%), Film B (Post, 88%)…
Card: INBOX — 3 unread (offer, review, rival move)
Card: INDUSTRY PULSE — chart rows
Action bar: [ Next Week → ] [+4W] [▶]
Bottom nav: Home Create Market Studio Business
```

**B.2 Create → Scripts (360px)**
```
App bar: [BW] Lighthouse Pictures        $12.4M  Y3·W12  🔔 ⚙
Sub-nav: [Scripts][Pitch][Audience][Craft][Rights][Talent]···
Card: HOT SPEC — "Title" — Script 82, Budget $45M, Timing HOT [Develop →]
Row: "Title 2" — Script 71, Budget $30M [Develop →]
Row: "Title 3" — Script 64, Budget $18M [Develop →]
Action bar + Bottom nav (unchanged)
```

**B.3 Business → Ledger (360px)**
```
App bar + Sub-nav: [Ledger][Capital][Forecast][Equity][M&A]···
Card: CAPITAL $12.4M · DEBT $3.1M · STANDING 68
Row: Week 12 — Box office +$2.1M, Overhead −$0.4M, Net +$1.7M
Row: Week 11 — … (scroll)
Action bar + Bottom nav (Business active, Finance dot if debt warning)
```

## Appendix C — Token additions (complete list)

```css
/* system/vertical.css — ONLY additions. Everything else reuses system/tokens.css */
:root{
  --chrome-top: 56px;
  --chrome-subnav: 44px;
  --chrome-action: 64px;
  --chrome-bottom: calc(64px + var(--chrome-action) + env(safe-area-inset-bottom, 0px));
  --content-max: 640px;          /* phone reading width */
  --content-max-wide: 1060px;    /* desktop (existing .view max — keep) */
  --bp-sm: 600px; --bp-md: 900px; --bp-lg: 1200px;
}
```

---

## Sign-off

- [ ] **Product owner:** IA (§4.2) + decisions D1–D5 approved
- [ ] **Engineering:** Phased plan (§10) + flag strategy (§9.1) approved
- [ ] **Design:** Shell (§5) + components (§6) + tokens (§7) approved

*On approval, Phase 1 starts immediately: `system/vertical.css` skeleton + shell DOM behind `data-layout="vertical"`, with before/after screenshots at 360px as the first deliverable.*
