# What's left from the old game — full gap audit

**Date:** 2026-11-14 · **Updated:** 2026-11-19 · Method: two exhaustive sweeps of the old codebase (rebuild-notes/old-features-inventory-a.md, -b.md) cross-checked against `game/`. Everything already ported is excluded.

## 0. Status as of 2026-11-19 — the audit is closed

The 18 "whole systems still missing" below were re-checked against `game/` by grepping
for each system's data tables and hooks, not just for its name. **13 of the 18 had
already been ported** (mostly by `exhibition.js`, `creative.js`, `biz.js`, `strategy.js`,
`challenges.js`, `social_viral.js`, `finance.js`, `empire.js`). The genuinely missing
systems were #10, #11, #12, #13 and #15, and those are now shipped as four new modules:

| Missing system | Now lives in | Desks | Harness |
|---|---|---|---|
| #10 product placement + physical media | `game/opsuite.js` | `ops-placement`, `ops-media` | `test/rebuild-opsuite.mjs` (74 checks) |
| #11 C-suite officers | `game/opsuite.js` | `ops-csuite` | `test/rebuild-opsuite.mjs` |
| #12 live-ops gacha + amenities + co-production + seasonal events | `game/liveops.js` | 4 desks, group `Live ops` | `test/rebuild-liveops.mjs` (83 checks) |
| #13 marketing blitz tiers (junket / Hall H / TV / Super Bowl / saturation) | `game/mktblitz.js` | 3 desks, group `Marketing` | `test/rebuild-mktblitz.mjs` (78 checks) |
| #15 console platform licensing + first-party hardware | `game/consolehw.js` | 3 desks, group `Games & hardware` | `test/rebuild-consolehw.mjs` (79 checks) |

Sub-features that were also missing and are now covered: finance ROIC / LBO / debt-to-EBITDA
ratios and the multi-currency table (`finance.js`, pre-existing), talent trait production
(`people.js`), soundstage tiers (`data.js` backlot), seasonal live events and the event
challenge progress (`liveops.js` — the legacy `eventProgressGross` was never incremented,
which was a real bug, now fixed).

All four modules are wired: `<script>` tags in `game/index.html`, `GAME_FILES` in
`apk/build-www.js`, `collectDesks()` + `onAction()` in `game/ui.js`, and the weekly ticks
plus the `blitzOpenMult` / `liveopsEventMult` / `opsCreditMod` / `opsCostMult` /
`opsOverheadMult` / `opsCastingFeeMult` / `liveopsAmenityMods` hooks in `game/engine.js`.
Every hook is `typeof`-guarded, so the game still boots if a module is absent.

---

### 0.1 Release regression (found and fixed in v45.0)

The v44.0 APK contained the **legacy** game, not this rebuild. `.github/workflows/release-apk.yml`
and `release.sh` both called `node apk/build-www.js` without `--rebuild`, and that flag is what
selects `game/` over the root legacy files. The result was a valid APK of the wrong product:
20.8 MB, 62 scripts, no phone shell, no safe-area handling, none of the rebuilt modules. v43.2
had shipped correctly (its build path used `--rebuild`), which is why the regression was invisible
in the release notes.

Confirmed by unpacking both published APKs and diffing the script lists:

| APK | scripts | legacy markers | rebuild markers |
|---|---|---|---|
| v43.2 | 39 | none | collection engine |
| v44.0 | 62 | industry-expansion, studio-nextwave, theater-chains, demographics, lot-life | collection engine only |

Fixed at every path that produces a shipped APK (workflow, `release.sh`, `package.json`
`apk`/`apk:web`), with an in-workflow verification step that fails the release if the bundle
lacks the phone shell or contains a legacy suite marker. `test/release-mode.mjs` (8 checks, in CI)
guards the build *mode* rather than the built output, so a future edit cannot silently revert it.

v45.0 verified: 47 scripts, 1.04 MB of JS, `mobile-shell`/`phone-ux`/all four new modules
present, service worker stripped, no legacy markers — and the same signing certificate as v44.0,
so saves carry over.

---

## 1. Whole systems still missing (18)

> Kept as the original audit record. See §0 for what actually shipped.

| # | System (old file) | What it does | Size |
|---|---|---|---|
| 1 | **Chain ownership** (theater-chains.js) | Buy 1 of 5 circuits ($70–280M, rep ≥45), own 960–3,600 screens, capture exhibitor split on your own screens (net ×1+share×0.5), weekly concession revenue, Dolby/VIP/4DX ticket-yield upgrades | M |
| 2 | **Four-quadrant demographics** (demographics-audiences.js) | Kids/Teens/Young-adults/Mature shares with favored genres, rating gating (R zeroes kids), per-quadrant legs decay, pre-release Tomatometer/Popcornmeter prediction | M |
| 3 | **Dial tests & script doctor** (demographics-audiences.js) | $0.35M minute-by-minute dial curve with third-act-sag flag; $1.5M script doctor (+10 quality rescue) | S |
| 4 | **PLF mastering & premium formats** (exhibition-plf-concessions.js) | Per-film IMAX 70mm/Dolby/4DX mastering ($1.2–2.5M, +12 buzz, +20–35% ticket surcharge) — beyond the one-time IMAX deal already ported | S |
| 5 | **Concession backend & Thursday previews** (exhibition-plf-concessions.js) | 3 exhibitor concession-split deals (0/12/20% of concessions vs rental), $1M Thursday midnight previews (+15 buzz) | S |
| 6 | **Theatrical re-releases** (exhibition-plf-concessions.js) | $3M re-release of a catalog title (+12% gross, half to studio cash) | S |
| 7 | **Insurance tiers & key-star indemnity** (production-insurance.js) | Choose 2.5%/85%, 3.5% key-cast (illness/scandal/recast, 90%), 5% full completion bond (exposure capped at greenlight budget); claims ledger | S |
| 8 | **Camera/lens formats & director sparks** (production-creativity-suite.js) | 4 formats ($0.15–1.8M, +3–15 quality); 3 random director sparks (+6–12 quality) | S |
| 9 | **Writers' room & remake vault** (production-creativity-suite.js) | Writers' room tiers T1–T5; $40M remake of a catalog title (q75, +35% nostalgia) | S |
| 10 | **Product placement & physical media** (studio-operations-suite.js) | 4 sponsor tiers on in-production films (+$5–12M advance, critic-penalty risk); steelbook/collector pressing with sell-through profit | S |
| 11 | **C-suite officers** (studio-operations-suite.js) | CFO/CMO/Head of Casting/COO: signing fee + weekly salary + perks | S |
| 12 | **Live-ops & co-productions** (live-ops-coproduction.js) | Blind-box talent scouts (4 rarities), 4 studio amenities, co-production pacts (40–50% budget refund), seasonal events | M |
| 13 | **Marketing blitz tiers** (marketing-blitz-engine.js) | Late-night junket +22, fast-food tie-in +28, Super Bowl spot +50 buzz — release-level buys beyond the viral campaigns | S |
| 14 | **Creator ambassadors & social extras** (social-viral-network.js) | 4 creators with genre-matched perks on 12-week deals; campaign legs bonuses (+8–20%); review-defense bot shield; cast AMA (+8 rep) | S |
| 15 | **Console platform & proprietary hardware** (gamedev-console-hardware.js) | Dev-kit licenses for 4 platforms, $350M proprietary console with royalties, talent sabbaticals | S |
| 16 | **Seeded challenges & leaderboard** (challenge-leaderboard.js) | Date-seeded daily/weekly challenge runs with modifiers, checksummed share codes, local Hall of Fame | M |
| 17 | **Studio imprints** (industry-expansion-suite.js) | Genre-matched imprints: prestige +4 critic, genre label +3.5% opening, family +2.5%/+2 | S |
| 18 | **Hindi/Marathi i18n** (i18n.js) | EN/HI/MR chrome translation, lakh/crore formatting | M |

## 2. Partial systems — missing sub-features

| System (already ported) | Missing sub-features |
|---|---|
| **Clash** | Counter-programming windfall (+16% opening for romance/comedy/horror/drama opposite ≥2 tentpoles); per-rival cannibalization (−12%/−18% scaled); tentpole-threat premium; severity grading (LOW/MODERATE/CRITICAL); holdover congestion ±3 weeks |
| **Franchises** | Shared-universe charter ($30M, multi-franchise branches); lore consistency stat (scales crossover ×); universe fatigue (>2 releases/year → decay to 0.65×); scaling crossover multiplier (capped 1.65×); **franchise revival campaign** ($8M: fatigue −0.14, decay +0.18) |
| **Territory licensing** | Rev-share deal model (20% upfront/55% backend) alongside MG; region genre-fit ±30%; per-deal localization toggle (+25% regional gross, $0.8M); rights-window terms 13/26/52/104 weeks; offer pricing from quality + cast power |
| **Syndication** | 3 package tiers (primetime 52wk / matinee 26wk / cable 12wk) with eligibility gates (WW ≥ $80M/$25M/$5M or rating ≥ 70/50/30); rating-scaled upfront; one-deal-per-film exclusivity |
| **Facilities** | Soundstage complex (+3 quality/tier, max 5), LED virtual volume (+5 quality, −2%/tier location cost); lease-out mode (rent to third parties at 1.5× maintenance); weekly maintenance drain; genre budget discounts (−28% cap); 5-tier cost curve |
| **Espionage** | Active mission menu (choose mission + target, explicit risk 5/10/20%); counter-PR leak (−22% rival opening buzz, $1.25M); talent-contract intel (15–20% poaching discounts) |
| **Nextwave** | Rival counter-programming AI (rivals dodge your tentpoles ±1–2 weeks); choice incidents (cyberattack, script leak, crew dispute — contain/own/ignore); ESG pledge targets with 52-week audits; production scheduling windows with slate conflict-checking; rival bid/counterbid market for free agents |
| **Finance desk** | Studio DCF valuation (5-yr FCF, WACC grid); comparable-company analysis; LBO screen for IP acquisitions; key-ratio dashboard (debt/EBITDA, ROIC); 7-currency display incl. crores; save-slot repair tool |
| **Dynasty** | Voluntary NG+ succession (not just bankruptcy); 4 heir backgrounds (auteur/Wall Street/royalty/digital native with real perks); valuation-scaled inheritance (12% valuation, rep halo); heirloom IP carryover (2 films restart as franchises); generation counter |
| **Talent contracts** | Trait production effects (Fast Shooter −2 shoot weeks, Improv Master +6 script); trait market effects (Cult Icon +35% streaming value, Method +15% award odds); pact signing bonuses |
| **Cinematic universe fatigue** | covered above under Franchises |

## 3. Already covered (verified, not listed above)
Core pipeline, box office math, rivals + slate, OTT deals + windowing, streamer/series/live TV/syndication, franchises + crossover, merch/park/megadome/stage/shorts, game studio core, bonds/board/insurance(partial)/locations/chains+IMAX/presales/espionage(partial)/programs/stock/restoration, agency + pic deals + XP + abilities, fan club, sandbox talent creators, FYC/festivals/test screenings/viral/conventions/crisis protocols, recuts/clearance, library, scenarios, difficulty, dynasty heirloom, themes, strikes/piracy/econ events, trends, forecast, mezzanine, save import/export, 2 facilities, backlot.

## 4. Deliberately dropped (visual/cosmetic — say the word if you want them)
2D pixel lot + agent-life sim + department cutaways + interior customization · 16-bit theme suite · synth soundtrack · EN/HI/MR chrome translation (mechanically relevant, listed as #18) · poster-frame cosmetics.

---

## Suggested wave-3 build order (by gameplay value per effort)
1. Demographics model + dial tests + script doctor (touches quality/audience math — high impact)
2. Insurance tiers + key-star indemnity; syndication tiers; territory rev-share + localization + rights terms (upgrade existing desks)
3. Clash analytics depth + rival counter-programming AI (makes release planning genuinely tactical)
4. Chain ownership + PLF mastering + concessions + Thursday previews + re-releases (the exhibition empire)
5. Camera formats, director sparks, writers' room, remake vault; marketing blitz tiers; creator ambassadors; imprint labels
6. Product placement, physical media, C-suite; live-ops gacha/amenities/co-pro; console hardware
7. Finance desk analytics + dynasty NG+ succession + seeded challenges + imprints
8. i18n (hi/mr) last
