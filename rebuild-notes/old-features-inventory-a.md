# Old-Features Inventory — A (14 root files, player-facing mechanics)

Date: 2026-11-14. Scope: per file — (1) what the player can DO, (2) weekly/automatic effects on money/quality/buzz, (3) data tables shipped. Verdicts = old file vs `game/` rebuild, grounded in the rebuild feature list plus grep verification of `game/*.js` (paths cited where checked). All "old" evidence is from the named root file itself (first-hand code).

---

## 1. live-ops-coproduction.js (479 lines) — VERDICT: MISSING
- **DO:** pull $3.0M blind-box talent scouts (rarity roll → talent added to roster); install 4 studio-floor amenities ($1.5–4M); sign 1 of 2 co-production pacts on an unreleased project (instant refund of 40–50% of budget); open Talent-Scout/Live-Ops + Co-Pro modals.
- **AUTO:** seasonal event banner cycles by week ((week/4)%3) promising genre BO ×1.35–1.50 + a target-gross challenge with cash reward — but `eventProgressGross` is never incremented in-file (inert unless the host updates it). Amenity buffs are display text only — no engine hook in-file; only trophy_gallery applies +5 rep at install. Co-pro backend rev-share described, never enforced in-file.
- **DATA:** GACHA_RARITIES (4 tiers, 70/22/7/1%), SEASONAL_EVENTS (3), STUDIO_AMENITIES (4), RIVAL_ALLIANCES (2: Titan 50/50, Horizon 40/40).

## 2. production-creativity-suite.js (371 lines) — VERDICT: MISSING
- **DO:** equip camera/lens format per project (4 options, $0.15–1.8M, +3–15 quality); trigger a director creative spark (random pick of 3, $0.3–1.2M for +6–12 quality); upgrade writers' room T1→T5 ($1.5M×current tier); greenlight a remake of a released catalog title ($40M → new project q75 / buzz85, "+35% nostalgia").
- **AUTO:** none weekly; the writers' room "quarterly spec scripts" claim exists only in log copy — no generation code in-file.
- **DATA:** CAMERA_LENS_FORMATS (Arri digital, 35mm anamorphic, 70mm, vintage 16mm).
- Rebuild check: `remake|reboot`, `cameraFormat|lens` → 0 hits in `game/`; rebuild "recuts" ≠ catalog remakes. No writers-room mechanic (`writers' room` copy only).

## 3. studio-operations-suite.js (499 lines) — VERDICT: PARTIAL
- **DO:** sell product placement on in-production films (4 sponsor tiers, +$5–12M advance, stores criticPenaltyRisk 5–15%); press physical-media batches (steelbook/collector box: pressing cost vs sell-through profit scaled by film gross); hire 4 C-suite officers (signing fee + weekly salary + stated perk); build 4 backlot stages ($18–35M).
- **AUTO:** C-suite weekly salaries (0.07–0.10M) are recorded but never deducted weekly in-file; perks are text only. Soundstage discounts exposed via `getBacklotData()` for the host to apply.
- **DATA:** SPONSOR_TIERS (4), PHYSICAL_FORMATS (2), SOUNDSTAGE_LOTS (stage / water tank / LED volume / render farm), CSUITE_OFFICERS (CFO, CMO, Head of Casting, COO).
- Rebuild check: backlot exists — `game/data.js:65` "Backlot & stages" (overrun-reduction levels); `placement|sponsor|steelbook|physical` → 0 hits. Rebuild "board" ≠ named executive officers with perks.

## 4. studio-agent-life.js (130 lines) — cosmetic/ambient sim; not in rebuild
- **DO:** none — no player buttons. Deterministic needs/task layer for lot characters: per-role job routines, breaks at energy<35, producer cross-department inspections, colleague meetings, take-phase participation.
- **AUTO:** continuous sim only: energy/fatigue/mood/relationships, greetings; soundstage take cycle prepare→rehearse→take→review advances when director+cameraman+star are at stations with energy≥35; accumulates work-seconds into `project.studioWork`. No money/quality/buzz effect in-file.
- **DATA:** task routines for 9 roles, 8 staff names, take-phase durations.
- No `StudioAgentLife` layer exists in `game/` — skip for mechanics purposes.

## 5. gamedev-console-hardware.js (400 lines) — VERDICT: PARTIAL
- **DO:** buy dev-kit licenses for 4 fictional platforms ($0.5–3.5M); build the proprietary console (rep ≥75, $350M R&D, claims +$0.25M/wk royalties); send talent on a $0.2M sabbatical (stamina→100, scandal −15); workforce roster UI with search + filter (recovery priority / booked / free).
- **AUTO:** console royalty exists only in log copy — no weekly payout loop in-file; staff stamina has no decay logic in-file (read-only, defaults 85).
- **DATA:** GAMING_PLATFORMS (4, with market share + royalty rate), PROPRIETARY_HARDWARE (1), RECRUITMENT_TIERS (4) — recruitment tiers are exported but never used by any function.
- Rebuild check: game studio exists (topics/genres/press/GameCon) but `console|devkit` hits only the core `games.js`; no platform licensing, proprietary hardware, or stamina/sabbatical layer (`stamina|energy|sabbatical` → 0 hits).

## 6. marketing-blitz-engine.js (290 lines) — VERDICT: PARTIAL
- **DO:** book 5 campaign tiers against one unreleased project — viral guerrilla $0.5M +15 buzz, late-night junket $1.2M +22, fast-food tie-in $2.5M +28, Comic-Con Hall H $3.5M +35, Super Bowl spot $8M +50; per-project poster-frame cosmetic picker (35mm cell / gold / neon / VHS).
- **AUTO:** none — buzz applied instantly at booking; duplicate campaign per title blocked.
- **DATA:** MARKETING_TIERS (5, each with demographicFocus).
- Rebuild check: viral campaigns + fan conventions ported (`game/pr.js:195`, weeks 22–24, one/year) + FYC blitz (`pr.js:16`); but none of the four named non-viral tiers (Super Bowl, fast-food, junket, Hall H) has an equivalent (`superBowl|hallH` → 0 hits).

## 7. demographics-audiences.js (356 lines) — VERDICT: PARTIAL
- **DO:** run a $0.35M dial-test screening on a project → 6-point minute-by-minute dial curve + computed critics/audience scores + quadrant affinity bars; hire a $1.5M script doctor (+10 quality).
- **AUTO:** none; appeal is a pure function of genre/theme/rating over the quadrant table; results cached per film.
- **DATA:** AUDIENCE_QUADRANTS (kids/teens/young-adults/seniors, each with sharePct, favored genres+themes, decayRate 0.78–0.90).
- Rebuild check: test screenings ported (`game/pr.js:130` — one per project, post-phase, feeds reshoots); the four-quadrant demographic model, minute-by-minute dial curve, and script-doctor action have no counterpart (`dial|scriptDoctor` → 0 hits; rebuild "trends" ≠ quadrant affinity).

## 8. exhibition-plf-concessions.js (393 lines) — VERDICT: PARTIAL (mostly missing)
- **DO:** master a film in a PLF (IMAX 70mm / Dolby / 4DX: $1.2–2.5M, +12 buzz, ticket surcharge +20–35%); switch among 3 exhibitor concession-backend deals (0 / 12 / 20% of concessions vs 42–55% rental); book $1.0M Thursday midnight previews (+15 buzz); launch a $3.0M theatrical re-release (+12% gross, half credited to studio cash).
- **AUTO:** none weekly; surcharges/rental splits stored on the project for host box-office math.
- **DATA:** PLF_FORMATS (3), CONCESSION_DEALS (3).
- Rebuild check: one-time IMAX deal ported (`game/biz.js:242` bizImaxDeal, $30M, wider openings for action/scifi/fantasy) — but no per-film PLF mastering, no concession-backend deals (`concession` → data.js only), no Thursday previews (`thursday|preview` hits are `qPreview` quality, unrelated), no re-release mechanic found.

## 9. settings-studio.js (809 lines) — VERDICT: PORTED
- **DO:** Theme Studio — 13 complete looks (10 dark / 3 daylight) with live mini previews, dark/daylight filters, surprise-me, restore-classic; 7 appearance prefs (accent intensity, UI density, contrast, film grain, deck tinting, transparency, 48px tap targets). Save Vault — 6 named slots with save/load/rename/duplicate/download/delete, corrupt-slot repair, base64 code + readable-JSON export/import, manual safety copies, storage meter, integrity check.
- **AUTO:** weekly safety net — IndexedDB checkpoint every 4 weeks + full auto-backup every 12 weeks (`maybeAutoBackup`), restorable from the vault.
- **DATA:** PREFS (10 localStorage keys), slot metadata (date/cash/rep/films/scenario/difficulty/sandbox).
- Rebuild has themes and save import/export per feature list; the 4/12-week auto-backup ring and corrupt-slot repair depth are beyond what the list names (unverified in rebuild — flagged, not asserted).

## 10. challenge-leaderboard.js (286 lines) — VERDICT: MISSING
- **DO:** launch deterministic daily (104-week target; date-seeded archetype + modifier, e.g. Credit Crunch: interest +40%, debt cap $200M) or weekly (156-week mission, e.g. Indie Survival Gauntlet) seeded runs; copy/import checksummed "BOW-" share codes into a local Hall of Fame.
- **AUTO:** none; score computed on modal open (cash + valuation + gross + hits + awards + rep − debt + weeks).
- **DATA:** Mulberry32 PRNG + FNV-1a seed hashing; 5 archetypes, 5 daily modifiers, 3 weekly scenarios.
- Rebuild has scenarios/difficulty but no date-seeded challenge runs or share-code leaderboard (`leaderboard|daily` → data.js only, ambiguous).

## 11. custom-sandbox.js (387 lines) — VERDICT: PARTIAL
- **DO:** Creative Lab — create custom talent (name/role/star power/skill/genre/quirk), custom rival studio (slate style/war chest/color), custom franchise (genre/lore), custom screenplay (scale/buzz); Holiday Calendar modal listing 8 seasonal corridors with BO multipliers and your slated releases per window.
- **AUTO:** corridor multipliers (×1.15–×1.60 at weeks 1/7/18/26/35/43/47/51) are a lookup table — never applied in-file.
- **DATA:** HOLIDAY_CORRIDORS (8), QUIRKS (6 talent traits).
- Rebuild check: sandbox talent creators ported (feature list); custom rival/franchise/script creation not evidenced; seasonality is ported as weekly corridor multipliers (`game/engine.js:122-124`, ×1.02–1.30) but there is no browsable holiday-calendar modal.

## 12. i18n.js (222 lines) — VERDICT: MISSING (non-mechanical, player-facing)
- **DO:** language switch English / हिन्दी / मराठी for all chrome (tabs, buttons, start screen, settings); text-size and Devanagari-numeral options.
- **AUTO:** Hindi-only number/date formatting (lakhs/crores, HI_MONTHS); translated event/news stubs (tEvent/tNews) — long dynamic copy stays English.
- **DATA:** I18N en/hi/mr key tables (~90 keys each), LANGS metadata.
- Rebuild check: `hindi|marathi|language|i18n` → no hits in `game/*.js` (index.html is `lang="en"`).

## 13. studio-actors.js (44 lines) — purely visual; skip mechanics
- Sprite/animation atlas loader and draw code for lot characters (states, directions, role palettes, speech bubbles, hit boxes, interpolation). No player decisions, no state effects. No counterpart in rebuild.

## 14. studio-departments.js (193 lines) — cosmetic + one light choice
- **DO (light):** interior customization per cutaway room — style/floor/seating/decor pickers persisted to state (`setInteriorSettings` → `G.lotInteriors`); the rest is rendering (5 room types, furniture atlases, seated poses).
- **AUTO:** none; explicitly read-only over the canonical lot state.
- **DATA:** interiorOptions (4 style / 4 floor / 4 seating / 3 decor), 3 furniture frame-map tables, 5 room themes.
- No cutaway-room layer in rebuild; the interior-customization choice has no economic effect either side.

---

## Cross-file summary
- Whole-system MISSING from rebuild: blind-box gacha scouting, studio amenities, co-production pacts, seasonal live events, camera/lens formats, director sparks, writers' room, remake vault, product placement, physical-media pressing, platform dev kits + proprietary console, stamina/sabbatical, Super-Bowl-class marketing tiers, four-quadrant demographics + dial curves + script doctor, per-film PLF mastering, concession-backend deals, Thursday previews, theatrical re-releases, seeded daily/weekly challenges + leaderboard, EN/HI/MR localization, and the entire 2D-lot living-world layer (agent life + actors + department cutaways).
- Verified-port anchors in rebuild: backlot (data.js:65), IMAX deal (biz.js:242), test screenings (pr.js:130), conventions (pr.js:195), seasonality corridors (engine.js:122-124), themes + save import/export, sandbox talent creators.
