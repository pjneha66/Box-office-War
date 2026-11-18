# Moving the "More" tab into the four main tabs

Scope: **proposal only.** No code or game logic was changed.
Source: `game/ui.js` (the UI that the `--rebuild` APK ships), `game/index.html`.

## 1. Current layout

Bottom bar (`game/index.html`, `#tabbar`):

| Slot | Tab | Notes |
|---|---|---|
| 1 | Studio | `vStudio()` — cash, in-production films, trade news, rivals |
| 2 | Develop | `vDevelop()` — Scripts / Slate / Series sub-tabs |
| 3 | **Week** | advances one week (centre button, keep as is) |
| 4 | Playing | `vPlaying()` — weekend chart, films in theatres, release calendar |
| 5 | Ledger | `vLedger()` — P&L, genre economics, bank, studio record, facilities, settings |
| 6 | More | `vMore()` — grid of **80 feature desks** grouped by `desk.group` |
| 7 | Collection | `vCollection()` — box-office collection desk (separate tab) |

So today there are **six tabs plus Week**, and **Collection** sits outside the four core areas.

`vMore()` builds its grid from `collectDesks()`, which concatenates the `*_DESKS` arrays from the feature files. Each desk already has an `id`, `group`, `icon`, `name`, `desc` and `render()`. `findDesk(id)` looks desks up by id, so a desk can move to another tab without breaking its `desk-open` action.

## 2. Proposed four main tabs

| Main tab | Job | Keeps / receives |
|---|---|---|
| **Studio** | Run the lot and the people | Current Studio view + Talent, Lot, Crew, Production, Mastery, Career, Technology, Challenges |
| **Develop** | Create the next thing | Current Develop view (Scripts / Slate / Series) + Creative, Strategy, Library & fans, Game studio, Posters, World |
| **Playing** | Release and sell it | Current Playing view + **Collection** (as a sub-tab) + Distribution, Exhibition, Deals, Events, Press, Audience, PR & Awards, Awards, Social, TV & Streaming, Intrigue |
| **Ledger** | Money and franchises | Current Ledger view + Finance, Finance desk, Licensing, Empire & Franchises, Industry |

Week stays as the centre action. Settings, Save slots, Help, Hall of Fame and the Awards ledger move out of the More grid into a single **gear / menu** button in the header, so they are still one tap away.

## 3. Desk-by-desk mapping

Counts are from `game/*.js` (78 desks total).

### Studio (21 desks)
| Group | Desks | Count |
|---|---|---|
| Talent | Cameos, Casting chemistry, Youth academy, Talent agency | 4 |
| The lot | Lot & staff | 1 |
| Crew | Crew & production | 1 |
| Production | Production insurance, Locations | 2 |
| Mastery | Genre mastery, Agency relations | 2 |
| Technology | Research tree | 1 |
| Career | Trophy gallery, Career top-250, Audience analytics, Scenario forge, Game studio depth | 5 |
| Career 2 | Season pass, Hall of legends, Trilogy board, Content packs | 4 |
| Challenges | Challenges & Hall of Fame | 1 |

Note: **Career** and **Career 2** are the "meta" layer (trophies, leaderboard, season pass). Put them under one **Career** sub-tab, not spread across the screen.

### Develop (14 desks)
| Group | Desks | Count |
|---|---|---|
| Creative | Camera & sparks, Writers room & remakes, Demographics & dial tests | 3 |
| Strategy | Pricing strategies, Streaming wars, Local divisions | 3 |
| Library & fans | Library, Fan club, Sandbox | 3 |
| Game studio | Game studio | 1 |
| The lobby | Poster wall, Poster studio | 2 |
| World | Rival storylines, Studio museum | 2 |

Note: the **Sandbox** desk belongs here; it lets the player create talent, rivals and franchises, which is creative work.

### Playing (27 desks — split into sub-tabs)
| Sub-tab | Group | Desks | Count |
|---|---|---|---|
| **Collection** | (existing view) | Box-office collection | — |
| Release | Distribution | Theater chains, Territory pre-sales | 2 |
| Release | Exhibition | Chain ownership, Premium formats, Previews & re-releases | 3 |
| Release | Deals | Rival negotiations, Screens & territories | 2 |
| Release | Events | Premiere plans, Event log | 2 |
| Audience | Press | Press relationships, Ratings appeals, Premiere market | 3 |
| Audience | Audience | Test screenings, Social & viral, Fan conventions | 3 |
| Audience | Social | Social Viral | 1 |
| Awards | PR & Awards | Awards & FYC, Festival circuit, Crisis retainer | 3 |
| Awards | Awards | Awards history, Festival circuit (board) | 2 |
| Broadcast | TV & Streaming | OTT deals, Streaming platform, Series studio, Live network, Syndication | 5 |
| Broadcast | Intrigue | Espionage desk | 1 |

Note: "Festival circuit" appears in two groups (`pr.js` and `festivals.js`). Keep one entry when moving it; the two desks have different ids, so the duplicate has to be checked before merging.

### Ledger (14 desks)
| Group | Desks | Count |
|---|---|---|
| Finance | Credit & bonds, Studio board, Stock & restoration | 3 |
| Finance desk | Corporate finance | 1 |
| Licensing | Licensing market, International offices | 2 |
| Empire & Franchises | Franchises & crossover, Merchandising, Theme park, Sports megadome, Stage division, Shorts studio, Sports megadome (stadium) | 7 |
| Industry | Programs & imprints | 1 |

Note: **Empire & Franchises** has two "Sports megadome" entries (`empire.js` `emp-dome` and `stadium.js` `stad-main`). Check they are the same feature before merging.

### Utilities → header menu (2 desks + existing buttons)
| Item | Destination |
|---|---|
| Save slots (`slots-mgr`), Studio logo (`slots-logo`) | Gear menu → Save & profile |
| Settings, Help & Guide, Hall of Fame, Awards Ledger, Save Progress | Gear menu |

## 4. Implementation notes (for when this is approved)

1. **Add a `tab` field to each desk** (e.g. `tab: "playing"`) instead of moving code. One line per desk, no logic change. `vMore()` can be deleted once every desk has a home.
2. **Reuse the sub-tab pattern** already used by Develop (`DEV_TAB` + `data-action="dev-tab"`). Add the same for Playing (`PLAY_TAB`) and Studio (`STUDIO_TAB`). This keeps each main tab short.
3. **Mobile first:** six bottom tabs plus Week is too many for 360 px wide. Four tabs + Week leaves room for labels.
4. **Desk-open flow is unchanged:** `findDesk()` and the `desk-open` action keep working, so existing test ids survive.
5. **Test impact:** the `vMore` count (`Feature desks · N`) and any test that clicks the More tab will need updating. Run the suite before and after.

## 5. Decisions needed from you
- Confirm the four tab names: **Studio · Develop · Playing · Ledger** (or rename, e.g. "Business" for Ledger).
- Confirm that **Collection** should live inside **Playing**, not stay as its own tab.
- Confirm that **Settings / Save / Help / Hall of Fame** go to a header gear menu.
- Decide what to do with the two duplicate-looking desks (Festival circuit, Sports megadome) — merge or keep both.

---

## 6. Status — implemented (approved decisions applied)

| Decision | Applied as |
|---|---|
| Ledger → **Business** | Bottom-bar label, header title and tab label. The internal view id stays `ledger` (smaller change). Hindi/Marathi strings added in `game/i18n.js`, though `t()` is currently an identity function, so they are not shown yet. |
| Collection goes inside **Playing** | Playing has a sub-tab row: Now playing · Collection · Release · Audience · Awards · Broadcast. Collection's content and levers are unchanged; only its placement changed. |
| Settings and save slots → **header gear menu** | ⚙️ button in the header opens one sheet with Save slots, Studio logo and Settings (theme, accent, text size, sound, save & load, new game). Settings no longer appears on Business. |
| Duplicate pairs stay separate, names made unique | Festival circuit → "· PR tour" (`pr.js`) and "· Awards board" (`festivals.js`). Sports megadome → "· Empire" (`empire.js`) and "· Arena deals" (`stadium.js`). Ids were already unique. |
| Four main tabs | Studio · Develop · Playing · Business, plus the centre Week button. More is removed. |

**How desks are placed.** Each desk's existing `group` string decides its home (`DESK_GROUPS` in `game/ui.js`), so no desk file needed structural edits. Counts: Studio 21 · Develop 14 · Playing 27 · Business 14 · gear 2 = 78. Any unknown group falls back to Business · Finance.

**Verification.**
- `test/rehome-tabs.mjs` (new, `npm run test:rehome`) boots `game/index.html` in jsdom: 23/23 checks pass. It covers the bar, desk placement, unique names, every tab and sub-tab, every desk opening, and the gear sheet.
- `test/rebuild-*.mjs`: the set of failures matches the original commit exactly (crew, licensing, talent_agency, world, and rebuild-ui, which needs Chrome). `rebuild-biz` and `rebuild-people` fail intermittently on both the original and the new tree (about 5% and 2–5% of runs), so they are pre-existing flakiness.
- `test/rebuild-ui.mjs` and the two capture scripts were updated for the new layout, but the Chrome test can't run in this sandbox.

**Open items**
- The **root** `index.html` (the Vercel web build) is a separate older UI with its own six-tab bar and More sheet. It was not changed. Say if it should get the same layout.
- "Redesign Collection": I only moved it. A visual redesign of its layout is a separate pass if you want it.
- Help and Hall of Fame from the old More sheet do not exist in the `game/` UI, so nothing was added for them.
