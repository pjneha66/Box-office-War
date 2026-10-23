# PASTE-READY PROMPT — LIBRARY DESK rebuild + rebrand + bug fixes (v36.0)

Copy everything between the lines into a fresh session in `pjneha66/Box-office-War` on a new Arena branch.

---

Rebuild the **Library** tab of this repo into a `LIBRARY DESK / YEAR n` command desk at the same standard as **v35.0 EMPIRE DESK** (PR #18, merged) and **v34.9 LIVE DESK** (PR #17). It is a **bug-fix-first, then rebuild, then add features** task: **replace the whole visual language of the tab, including every old element nested inside its sub-tabs** — no legacy `.card` / `.section-title` / `.cost-line` / `.stat-hero` surfaces may survive inside the Library screen, and no old-looking control may be left sitting inside a new panel. Bugs come before features.

## 0. Facts to start from (verified in the current tree — re-verify, do not trust blindly)

- Tab registration: `index.html` line ~130 `data-tab="library"`; mobile bottom-nav group `more` (`v31-features.js` ~340).
- View entry: `viewLibrary()` at `ui.js:7332`; dispatch at `ui.js:1222` (`else if(TAB==="library") h=viewLibrary();`).
- Sub-tab state: `let LIBRARY_SUB = "films";` (`ui.js:1928`) — **not persisted** across reload.
- Two sub-tab nav systems are live at once for this tab: the in-view `.subnav-pills` strip (`ui.js:7333-7348`, `data-libsub`, bound at `ui.js:6909`) **and** the global `#subTabs` strip driven by `TAB_META.library` (`v31-features.js:351`) because `library` is missing from the "single branded nav" exclusion list at `ui.js:2047`. Fix this the way Empire A1 did.
- Existing 4 sections: `films` / `series` / `physical` / `vault`.
- `physical` delegates to `StudioOperationsSuite.renderPhysicalMediaSection()`; `vault` renders a one-card stub with `#btnRestorationVault` (`openRestorationModal`, `ui.js:6551`). Restoration engine also exists as `film-restoration.js` and `BOW_RESTORATION.tickWeekly` (`engine.js` tick block ~4583).
- The engine has a *second* concept of "your library" that the tab never shows: acquired indie libraries / firesale vault films (`engine.js:7049` creation, `engine.js:7096` distributable list, `engine.js:7213-7244` lifecycle), plus library licensing income `earn("library", catalogValue()*0.0045)` at `engine.js:4582`, and `catalogValue()` / `G.maLibraries`.
- Version pins after PR #18 sit at **35.0** (`index.html` `meta[name=app-version]` + every `?v=` query), **`bow-v95`** (`sw.js` `CACHE`). `package.json` / `version.json` still read 33.4 — pick one story and state it in the PR body, don't silently half-bump.

## 1. Non-negotiable working rules

1. **Test-first, one commit per bug.** For every bug in Part A, write the failing assertion first, run it, capture the RED output, then fix, then show GREEN. One commit per bug (`A1`, `A2`, …). No mixed "fix + feature" commits.
2. **Bugs before features.** Part A must be complete and green before Part B/C landing work starts.
3. **No invented figures.** Every number rendered must come from live state through a shared helper — the card, the modal, and the engine must read the *same* function. No decorative percentages, no fake ranks, no "projected" numbers without the basis written on screen.
4. **Honest refusal.** Any action that cannot run returns `{ok:false, reason}` from the engine helper, shows `reason` in a toast, and plays **no** gold/cash SFX, no flash, no modal close, no optimistic cash change. Unmet buttons render `disabled` with requirement copy.
5. **Preserve every existing selector/engine entry point** (list in §5). Rebuild the surface, never the contract.
6. **No new dependencies, no build step, no network calls.** Pure HTML/CSS/JS, works from `file://` and offline.
7. **Do not change game balance** (costs, multipliers, payouts). If a label was lying about a payout, fix the **label**, and document the relabel in the PR body (Empire A7 precedent).
8. **CSS scoped only** to `.command-library` + its panels in `command-deck.css`. No global `.view` rules, no `.card`/`.btn` restyling, no `overflow:hidden` masking, mobile `.bottomnav` clearance at 320/390px.
9. **Do not leave dead code behind.** Anything you orphan (`crossMediaTimeline`, `sharedUniverseDashboard`, unused filter keys, the duplicate nav strip) is either wired up or deleted in the same PR, and named in the PR body.
10. `node --check` every touched JS file and `git diff --check` clean before pushing.

## 2. Part A — bug fixes (audit all of these, prove each RED first)

These are **suspected** defects found by reading the current code. Reproduce or disprove each with a test; if a suspicion is not reproducible, state that in the PR body with the test that proves it correct and move on. Add anything else you find the same way.

- **A1 — duplicate sub-tab nav.** In-view pills *and* `#subTabs` both render the Library sections. Collapse to one persisted 5–7 chip nav (see §4), remove the duplicate strip path for `library` (`ui.js:2047`), keep the Kairo banner off this tab like the other desks.
- **A2 — the inline filter bar is dead.** `data-lib-type|genre|year|franchise` chips at `ui.js:7391-7394` have **no** handler anywhere; the only bindings are attached to modal-scoped nodes inside `openLibraryFilters()` (`ui.js:7475-7478`). Clicking the tabs' own filter bar does nothing. Wire one shared filter model used by both the bar and the modal, and make the modal and the bar show identical state.
- **A3 — filter state is not persisted and can crash.** `G.libFilter` is only created lazily at render (`ui.js:7358`) but written unconditionally at `ui.js:7475-7478` — if the modal is opened first (or a save is old), that write throws. Persist `LIBRARY_SUB` + the filter object in the save, initialise it in the engine, and migrate old saves without losing them.
- **A4 — contradictory type filter.** `LIBRARY_SUB` and `libFilter.type` both gate the same thing (`ui.js:7373-7374`): with `type:"all"` a Series-gated build can render films in the Series section and vice-versa; `filter.profit` is declared and **never used**. Remove the redundant axis (section == shelf, filters == genre/year/franchise/search/sort) and delete the dead key.
- **A5 — `$…M M` double-unit labels.** `fmtM()` already emits `$`+`M`/`B`; the cards append `"M budget"` / `"M peak viewers"` (`ui.js:7430-7434` and the film card above it) → `$50.0MM budget`. This is the Empire A5 bug class. Grep the whole tab for `fmtM(...)+"M` and `fmtG(...)+"M` and fix all of them. Add a regression assertion that no rendered string matches `\$\d[\d.,]*[MB]M`.
- **A6 — `undefined undefined` genre chips.** `DATA.GENRES[g]?.emoji+" "+DATA.GENRES[g]?.name||g` at `ui.js:7392` and `ui.js:7456`: `+` binds before `||`, so an unknown genre renders `undefined undefined` and the `|| g` fallback never fires. Same precedence class anywhere else in the tab.
- **A7 — dead series actions.** `[data-seq]` / `[data-spin]` on Library series cards dispatch through `G.series.find(x=>x.id===+b.dataset.seq)` (`ui.js:6612-6613`) — with a non-numeric/string series id the lookup silently fails, the click is swallowed, and gold SFX still plays. Make the resolver id-safe (shared `findSeriesById`) and make the button report refusal when the action is unavailable (e.g. ended series, no sequel hook).
- **A8 — duplicate element id + two different restoration entry points.** `id='btnRestorationVault'` exists twice (`ui.js:1584` studio heritage card, and the Library vault card at `ui.js:7352`), and `$()` binds only the first, while the vault section and the studio card call *different* code paths. Give the Library one a unique selector, keep both working, route both to the same helper, and handle "module not loaded" with a visible reason instead of a silent no-op.
- **A9 — silent fallthrough on `physical`.** If `StudioOperationsSuite` / `renderPhysicalMediaSection` is missing, `viewLibrary()` falls out of the `if` and quietly renders the films grid under the Physical heading. Refuse visibly instead, and prove the guard with a test that stubs the module out.
- **A10 — the tab calls itself the library but hides most of it.** Acquired library / firesale vault films (`engine.js:7049`, `7096`, `7213-7244`) and the weekly library licensing income (`engine.js:4582`) never appear; `releasedFilms` uses `f.ww > 0` while `releasedSeries` uses `seasons.length > 0` (an unaired first season disappears), and in-theatrical titles are excluded with no explanation. Define **one** catalogue source of truth in the engine (`libraryCatalogue()`) that both the tab and the existing distributors consume, and state the inclusion rule on screen.
- **A11 — filters disagree with the cards.** The year filter uses `f.releaseWeek || G.week` while the card prints `yearOf(f.releaseWeek)`; series filter matches *any* season year while the card prints `season[0]` year. So a title can be filtered out of the year you can see on it. Use one `titleYear()` helper for filter, sort and label.
- **A12 — profit basis is unstated.** Cards print `ww − breakevenWW(f)` as "profit" in the same type as gross WW figures. Either label it explicitly ("net vs breakeven, gross basis") or replace it with the real theatrical net from the same helper the Box Office desk uses. Do not ship two currencies in one line.
- **A13 — unbounded rendering.** Every released film renders a full card in a grid; a 150-film career renders hundreds of nodes on every `render()`. Add a bounded/virtualised shelf (chunked "load more" or windowed) and prove the render-node count in a test.
- **A14 — accessibility/honesty sweep.** Chips are `<button>` without `aria-pressed`; the two nav strips both look "active"; `aria-current` is inconsistent. Fix focus order, `aria-pressed`/`aria-current`, live-region announcements on filter change, and icon-only buttons need labels.

## 3. Part B — rebuild the tab as `LIBRARY DESK / YEAR n` (rebrand)

Replace `viewLibrary()`'s markup with a command-desk shell modelled exactly on `commandEmpire()` (`ui.js:7688-7691`) and `commandLiveDesk()`:

- `command-heading` with edition line `LIBRARY DESK / YEAR ${yearOf(G.week)}`, an eyebrow naming the shelves (e.g. `CATALOGUE / RIGHTS / RESTORATION / ARCHIVE`), an `<h1>` in the desk voice ("The studio catalogue."), a one-line description, and the shared week badge (`command-date`).
- Four honest telemetry cells above the nav: **Titles in catalogue** (films + series, inclusion rule stated), **Catalogue value** (`catalogValue()`), **Library income / wk** (the real `earn("library", …)` figure — read it from the engine, do not recompute it in the view), **Rights-ready titles** (count from the real availability helper), plus at most one secondary line (e.g. restoration queue).
- Numbered `command-section-nav` switcher (01…0n) replacing the pixel-pill strip; one nav, one persisted state.
- Every panel via a `libraryPanel(eyebrow, title, description, content, action)` helper; every card a desk row, not a legacy `.card`.
- Mobile: nav becomes a horizontally scrollable numbered strip; rows stack; `.bottomnav` clearance verified at 320/390/414; no horizontal overflow at any breakpoint.
- **Rename the tab consistently**: `tab.library` / `btab.library` in `i18n.js`, `TAB_META.library`, `index.html` button, plus any "Film library" / "Library" copy in tool pages that now points at a desk. Update the copy in the Box Office `#btnBoLibrary` tooltip so it says what the desk is.
- Old elements *inside* the sub-tabs must be converted too: the Physical 4K module and the Restoration module keep their internals but are wrapped in desk panels with desk typography; no leftover pale cards, no inconsistent heading scale.

## 4. Part D — sub-tab spec (7 sections, one nav)

Replace `films / series / physical / vault` with:

1. **Overview** — catalogue KPIs, recent additions, what needs attention (rights expiring, unrestored prints, titles not yet placed on a platform), empty-state onboarding for a new studio.
2. **Films** — searchable/sortable shelf, one card per film, actions preserved.
3. **Series** — seasons/EPS, last-season buzz, next-season and spin-off with honest availability.
4. **Rights & windows** — per title: current home (theatrical / pay-1 / OTT / own platform / syndication / PVOD) and when it becomes movable; reads the *same* helper the OTT desk uses (`movable`, `unsold` logic in `ui.js:5903-5915`).
5. **Catalogue & licensing** — how `catalogValue()` is built (itemised), weekly licensing income, acquired libraries (`G.maLibraries`), and the live M&A library offer path (`DATA.MA.library`), with the acquisition history.
6. **Physical 4K & box sets** — `StudioOperationsSuite.renderPhysicalMediaSection()` inside a desk panel.
7. **Restoration vault** — `film-restoration.js` queue wired live (cost, benefit, weeks), `BOW_RESTORATION` state, keep `#btnRestorationVault` behaviour.

`LIBRARY_SUB` defaults to `overview`, is validated against the section list on every render (fall back to `overview`, never crash on a stale value), and is persisted. Deep links from other tabs (`switchTab("library")`) land on the right section where the caller knows it (e.g. Box Office "Film library" → Films).

## 5. Part C — features (real state only, built on existing engine functions)

Ship these as separate commits after the desk shell:

- **C1 Search + sort + density** — live search over title/genre/franchise; sort by name, genre, year, WW, net, quality, recently added; persisted; node-count bounded (A13).
- **C2 Film dossier rows** — one `filmLibraryRow(f)` source of truth feeding card and modal (`openFilmDetailsModal`), with DOM/INTL/WW/budget/net all labelled.
- **C3 Series shelf** with honest sequel/spin-off availability (cost, requirements, refusal reason).
- **C4 Rights & windows board** — a sortable table of "title · current home · next window · weeks left", fed by the OTT availability helper; click a row → move-to-platform or the streaming deal modal.
- **C5 Catalogue value ledger** — itemised `catalogValue()` (films, acquired libraries, restored prints, franchises if it contributes), weekly licensing income, and a small trend line from real history if the state exists (otherwise no chart).
- **C6 Acquisition desk** — live M&A library offers, price, permanent catalogue value, expected weekly royalty, `G.maLibraries` history; buttons disabled with reasons when cash is short; wiring through the existing accept path.
- **C7 Restoration queue** — list of restorable titles with cost/weeks/upside, in-progress queue, completed restorations and their effect.
- **C8 Physical 4K & box sets** — surface the module's real numbers in desk form (no duplicate economics).
- **C9 Franchise & universe shelves** — group the catalogue by `franchiseName`, show cross-media ties (film/series/game/merch), "Open in Empire Desk ↗" via `switchTab("empire")`.
- **C10 Archive timeline** — either wire `crossMediaTimeline()` (currently dead, see §1.9) into Overview as a live component, or delete it and its dead sibling `sharedUniverseDashboard()` in this PR.
- **C11 Empty & onboarding states** — first-run studio: what a catalogue is, how films enter it, first three actions; every section has a real empty state with a next step, and none of them is a bare `.card muted`.

## 6. Verification gates (all must pass, all offline)

- **New** `test/library-desk.mjs` — A1–A14 regressions + B (shell, nav persistence, telemetry equality with engine) + C1–C11 + zero-legacy-surface sweep (populated *and* empty) + the `$…MM` string ban + node-count bound. jsdom/offline.
- **New** `test/library-desk-browser.cjs` — 320/390/414/844/1024/1440px, external requests blocked, zero console errors, zero horizontal overflow/clipping, `.bottomnav` clearance at 390px, screenshots to `/tmp/library-shots` (never in Git).
- Add both to `package.json` (`test:management` chain for the mjs, a `test:library:browser` script for the cjs).
- Existing gates stay green: `npm run test:management`, `test:ui`, `test:engine`, `test:pitch`, `test:rebrand`, `test:library` (`test/verify-library.mjs`), plus `header-visual-browser.cjs`.
- Run the app on `0.0.0.0` (port 3000) for any browser gate so it is previewable, and check it in the sandbox browser, not just jsdom.
- Bump the version pin unit to **36.0 / bow-v96** everywhere it is pinned today (`index.html` meta + every `?v=`), and say in the PR body exactly which files were changed and whether `package.json`/`version.json` were aligned.
- `node --check` on every touched file, `git diff --check` clean.

## 7. Definition of done / PR body must contain

1. The RED→GREEN line for each A-bug, with the failing assertion quoted.
2. Any suspicion you disproved, and the test that proves it correct.
3. Every relabel (old copy → new copy → why the old copy was untrue), and every behaviour you deliberately did **not** change (with reason).
4. The preserved-selector list (§5) and evidence each still works.
5. The zero-legacy sweep output, the breakpoint matrix, and the node-count bound.
6. Files touched, version pins, and the exact test commands you ran.
7. Open the PR from the session branch, link it to this prompt doc, and leave it **unmerged for review**.

## 8. Do not

- Do not touch the Empire / Live / Develop / Box Office desks' internals; only consume their helpers.
- Do not add new economy systems to make the desk look full. If a section has no real data yet, it gets an honest empty state.
- Do not "fix" a bug by hiding the control or by re-rendering after a fake success.
- Do not commit screenshots, `/tmp` output, or generated artifacts.
- Do not restyle shared `.card` / `.btn` classes globally to make one panel look right.
