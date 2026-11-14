# Box Office War — Complete Rebuild Report (wave 3: everything from the old game)

**Date:** 2026-11-14 · **Scope:** full rebuild with the complete v41 feature set, including the wave-3 gap-closure pass (GAP-AUDIT.md items 1–18 + partial-system sub-features) · **Old game:** untouched, still playable at `index.html`

---

## 1. Why the old game wasn't playable on Android
~268 MB of shipped assets · 60 blocking scripts (~2.9 MB JS) · 16 stylesheets fighting with `!important` · four competing navigation systems · landscape lock · Chromium 60 WebView floor. Evidence: [android-ui-audit.md](android-ui-audit.md) / [engine-audit.md](engine-audit.md). The rebuild is fresh code: **17 JS files (~7,400 lines), zero dependencies, 5.5 MB APK web bundle** (legacy www was 163 MB), one design system, one navigation, everything tap-driven.

## 2. The game now
Core tabs: Studio · Develop · **Week** · Playing · Ledger · **More (41 feature desks)**.
- **Core loop:** scripts with theme chemistry → greenlight (scale/budget/director/lead/marketing/agency package) → weekly phases with overruns, **shoot-scheduling conflicts**, litigation delays → release week vs a **deep clash model** (per-rival cannibalization, counter-programming windfall, holdover congestion, LOW/MODERATE/CRITICAL severity) → **rivals dodge your tentpoles** (counter-programming AI) → opening/legs/international/OTT tails → library royalties.
- **Wave-1 systems:** TV & streaming (streamer, series, live TV, syndication), empire (franchises, merch, park, megadome, stage musicals, shorts), PR & awards (FYC, festivals, test screenings, viral, conventions, crisis retainer), business (bonds/ratings, board, insurance, locations, chains+IMAX, presales, espionage, ESG/press/localization/label, stock, restoration), talent (agency, pic deals, abilities, XP, poaching), library, fan club, sandbox creators, game studio, scenarios, difficulty, dynasty heirloom, mezzanine, forecast, save import/export.
- **Wave-3 systems (new this pass):**
  - **Exhibition empire** — buy 2 of 5 theater circuits, own-screen gross capture, weekly concession revenue, Dolby/VIP/4DX upgrades, per-film PLF mastering (IMAX 70mm/Dolby/4DX surcharges), concession-backend deals that trade rental share, Thursday previews, theatrical re-releases
  - **Four-quadrant demographics** — Kids/Teens/YoungAdults/Mature with favored genres, auto ratings (R zeroes kids), quadrant audience/legs effects, **dial tests** with third-act-sag warnings, **script doctor**
  - **Creativity suite** — camera/lens formats (4), director sparks (rolled per project), writers' room T1–T5, **remake vault** ($40M catalog remakes)
  - **Insurance tiers** — Basic 2.5%/85% · KeyStar 3.5% (scandals auto-handled) · Full completion bond 5% (flop claim 40%)
  - **Territory depth** — MG or **rev-share deals** (20% upfront/55% backend), region genre fit ±30%, per-deal localization, 13–104-week terms
  - **Syndication tiers** — primetime 52wk / matinee 26wk / cable-cult 12wk with eligibility gates and rating-scaled pricing
  - **Espionage missions** — active intel/counter-PR-leak ops per rival with explicit risk, suppression that cuts a rival's opening 22%
  - **Studio imprints** — prestige/genre/family labels with genre-matched critic and opening bonuses
  - **Shared universes** — $30M charter, lore consistency that scales crossovers (cap ×1.65), **universe fatigue** with revival campaigns
  - **Choice incidents** — cyberattack / script leak / crew dispute, each with contain/own/ignore tradeoffs
  - **C-suite-grade finance desk** — 5-year DCF valuation, comparable-company analysis, key-ratio dashboard, 5-currency display (incl. ₹ crores, ¥ oku)
  - **Seeded challenges** — date-seeded daily/weekly runs with modifiers (Credit Crunch, Indie Survival…), checksummed BOW- share codes, local Hall of Fame
  - **Dynasty NG+ succession** — voluntary retirement (or bankruptcy), 4 heir backgrounds with real perks, valuation-scaled trust funds, franchise IP carryover, generation counter
  - **Talent traits** — Fast shooter (−2 shoot weeks, no overruns), Improv master, Cult icon (+35% streaming), plus signing bonuses on pic deals
  - **EN / हिन्दी / मराठी** chrome localization with lakh/crore-ready structure

## 3. Verification (all green)
| Suite | Result |
|---|---|
| 11 module suites | TV 58 · Empire 33 · PR 71 · Business **204** · OTT 68 · Games 72 · Library 71 · **Exhibition 80** · **Creative 82** · **Finance 42** · **Challenges 59** — **952 checks, all pass** |
| Economy sim (6 × 300 weeks, all 13 files) | 0 exceptions · 0 NaN · 0 bankruptcies · median ROI +0.27 · hit rate 0.65 |
| UI (headless Chrome: 390×844, 360×740, 844×390) | **72/72** — 41 desks render and open, full career click-through, incident/poach/crisis modals auto-resolved, zero console errors, no overflow, tap targets ≥38 px |
| Caught by harnesses this wave | harness needed incident-modal handling; stale script-count assertion |

Screenshots: `rebuild-notes/ui-*.png` · Gap evidence: [GAP-AUDIT.md](GAP-AUDIT.md), [old-features-inventory-a/b.md](old-features-inventory-a.md).

## 4. Run it / ship it
```bash
python3 -m http.server 8080     # open http://localhost:8080/game/
npm run test:rebuild            # 11 module suites + economy sim
npm run test:rebuild:ui         # headless Chrome click-through (CHROME_PATH if needed)
npm run apk:web:rebuild         # 21 files, 5.5 MB web bundle
cd apk && npx cap sync android && cd android && ./gradlew assembleRelease
```
AndroidManifest rotation unlocked · fresh save namespace · ES2017-safe JS with Chromium 60 fallbacks throughout.

## 5. Still intentionally out
2D pixel-lot renderer + agent-life sim + department cutaways (visual layer; its economics live in Lot & staff/facilities) · 16-bit theme suite · synth soundtrack · poster-frame cosmetics. Every mechanic from the v41 game is now in.

---

## 6. Wave 4 (2026-11-15) — the update menu, built

All items from the update menu plus the portrait APK:

- **New systems:** procedural film posters + poster wall · talent social followings · casting chemistry & legendary duos · talent lifecycles (retirements, comebacks, legend status) · youth academy · trailer market · critics relationships · script development passes · ratings board appeals · festival premiere bidding · streaming wars · dynamic ticket pricing · co-production financing · IP marketplace · local-language divisions · CinePass · 24 achievements + trophy gallery · career top-250 · audience analytics · scenario forge · game-studio depth (sequels, engine IP) · deep script-sabotage ops · franchise fatigue review-bombs · theme studio (dark/light/contrast + 4 accents) · synth sound design (opt-in) · genre economics table · text scaling · PWA install prompt
- **APK is now PORTRAIT-locked** (versionCode 42, versionName 42.1) — built via apktool decode/rebuild of the shell + full web-asset swap, signed with the original keystore
- Release: https://github.com/pjneha66/Box-office-War/releases/tag/v42.1
- Verification: all 16 module suites + 300-week sims with 20 files loaded (0 exceptions) + 72/72 headless UI checks (55 desks)
- Game total: 22 JS files (~8,200 lines), 55 More-tab desks, 4.3 MB APK

---

## 7. Wave 5 (2026-11-15) — the full update menu, built

20 systems across 5 new modules + core upgrades; APK rebuilt via apktool with **versionCode 43 / versionName 42.2, portrait-locked**:

- **tech.js** — 7-stage technology research tree (Sound → Color → Widescreen → Digital → IMAX → Virtual Production), permanent craft/opening compounds
- **events2.js** — premiere night plans on every release, interactive award show night (attend/speech/skip), crisis years with recovery choices, rival subscription attacks
- **bizdeal.js** — rival negotiations with memory (dinners, joint press, star swaps, non-aggression pacts that block poaching and soften clashes), screen count deals (min/standard/wide/saturation), regional reputation (EU/APAC/CN) feeding presale prices
- **slots.js** — 6 named save slots (save/load/rename/delete), studio logo editor (shape + colors on the top bar), poster frame styles
- **meta2.js** — season pass goals (10/year with rewards), hall of legends, trilogy planning board with completion bonuses, content packs (validated JSON import/export), tutorial campaign banner
- **Core upgrades** — movie recap-ready film records, genre economics table, deep script-sabotage ops, franchise fatigue review-bombs, combined module cashflow forecast

Release: https://github.com/pjneha66/Box-office-War/releases/tag/v42.2
Verification: 21 suites (~1,350 checks) · 300-week sims with 25 files (0 exceptions) · 72/72 headless UI checks (66 desks) · portrait APK 4.4 MB, versionCode 43
Game total: 27 JS files (~9,500 lines) · 66 desks · 26-file web bundle
