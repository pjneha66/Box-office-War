# Box Office War

> A deep Hollywood studio simulation and tycoon engine. Run a major film studio, navigate box office wars, build transmedia franchises, manage streaming platforms, and broadcast linear television networks.

[Play in Browser](https://box-office-war.vercel.app) | [Download Android APK v32.3](https://github.com/pjneha66/Box-office-War/releases/latest) | [License: MIT](LICENSE)

---

## Overview

Box Office War is an offline-capable Hollywood studio management simulation built entirely on client-side web standards. Players manage every dimension of an entertainment empire from a single production lot:
- Greenlight original screenplays and acquire high-profile intellectual properties.
- Package A-list actors, directors, writers, and producers through Hollywood talent agencies.
- Manage physical soundstages, virtual LED volumes, and audio post-production facilities.
- Navigate release calendar clashes, cannibalization risks, and seasonal holiday corridors.
- Monetize catalog libraries via theatrical runs, international territory pre-sales, linear TV syndication, consumer merchandise, and proprietary streaming services.
- Defend corporate standing against hostile board directives, corporate debt covenants, talent scandals, and rival studio espionage.

All simulation mechanics execute client-side with zero dependencies, zero microtransactions, and instant local storage persistence.

---

## What is New in v32.3

The v32.3 release introduces key simulation expansions harvested from benchmark reference projects (Box Office Inc, Box Office Sim 2, Silver Screen Story, TV Studio Story) alongside essential UI modernization and mobile runtime hardening:

### 1. Modernized Start Screen & Career Resume
- **Instant Resume Hero**: Automatically detects active career saves and presents a quick-launch studio card displaying studio name, date (Year/Week), cash reserves, industry reputation, and active release counts.
- **Visual Origin Archetypes**: Redesigned origin profiles (Indie Auteur, Rising Producer, Mogul Backing) with transparent starting parameters, weekly overhead breakdowns, and unique passive studio traits.
- **Interactive Save Slot Deck**: Three dedicated, persistent save slots with live studio metadata, occupied vs empty lot status pills, and keyboard navigation.
- **Segmented Difficulty Controls**: Easy, Normal, and Hard market presets with transparent rental modifiers (+12% to -12%) and optional Creative Sandbox mode.

### 2. Crisis PR War Room & Media Handling (`v31-features.js`)
- Real-time containment of talent scandals, production accidents, and press leaks.
- Four distinct crisis management protocols: Public Apology, Counter-Spin Blitz, Legal Settlement, and Independent Press Silence.
- Reduces weekly reputation drain and restores talent commercial viability.

### 3. International Territory Licensing Desk (`territory-licensing.js`)
- Sell pre-release distribution rights across major foreign territories (Europe, Asia-Pacific, Latin America, Middle East, Africa).
- Secure minimum guarantees (MG upfront cash advances) combined with ongoing weekly box office royalties.
- De-risks high-budget productions before theatrical release.

### 4. Hollywood Agency Packaging Desk (`v31-features.js`)
- Contract full project packages through premier Hollywood talent agencies (CAA, WME, UTA, and Boutique Indiers).
- Bundles top-tier directors, marquee leads, and award-winning writers with packaged salary discounts (10% to 25%).
- Unlocks agency packaging buzz bonuses for opening weekends.

### 5. 52-Week Strategic Holiday Corridors (`custom-sandbox.js`)
- Detailed release calendar mapping 8 major industry corridors: Memorial Day Kickoff, Fourth of July Spectacle, Labor Day Counter-Programming, Halloween Horror Window, Thanksgiving Family Frame, Christmas Megablock, New Year Holiday Holdovers, and Spring Break Run.
- Counter-programming multipliers reward distinct genre positioning away from rival tentpoles.

### 6. Mobile APK Version Synchronization Hardening
- Native Capacitor App integration checks the installed binary version (`versionName 32.3`, `versionCode 36`) against the live release catalog.
- Offline-first cache migration ensuring existing saves and settings carry forward without update prompts or version discrepancies.

---

## Simulation Architecture: 27 Modular Systems

Box Office War is structured into 27 decoupled simulation modules operating on an event-driven weekly tick loop:

| Module File | Simulation System | Core Mechanics |
|---|---|---|
| `engine.js` | Core Simulation Loop | 52-week calendar, weekly financial clearing, talent availability, box office decay, rival studio AI turns. |
| `data.js` | Industry Data & Balance | Talent pool (actors, directors, writers, producers), genres, archetypes, themes, awards, and historical milestones. |
| `ui.js` | Executive Interface | Responsive dashboard, wizard modals, tabs navigation, glassmorphic HUD chips, keyboard shortcuts (Cmd+K). |
| `studio-facilities.js` | Studio Lot & Soundstages | 4 facility tiers (Soundstage Complex, LED Volume, Atmos Mixing, Historic Lot), quality buffs, rival lot rental income. |
| `syndication-tv.js` | Television Syndication | Linear broadcast monetization (Primetime 26w, Matinee 39w, Cable 52w), catalog rights, advance fees. |
| `talent-contracts.js` | Multi-Picture Deals & Quirks | 3-picture and 5-picture talent retention pacts, 6 psychological quirks (`method_actor`, `crowd_puller`, `award_magnet`). |
| `bond-market.js` | Corporate Debt & Bonds | AAA to CCC corporate credit rating engine, 52-week securitized debt issuance, weekly interest service. |
| `clash-analytics.js` | Release Clash Radar | Opening weekend cannibalization analysis, audience overlap calculations, counter-programming bonuses. |
| `cinematic-universe.js` | Shared Cinematic Universes | Multi-franchise IP bibles, crossover event multipliers (+65% buzz), lore consistency tracking, fatigue control. |
| `location-scouting.js` | International Production Hubs | Global production locations (London, Atlanta, Iceland, Tokyo, New Zealand) providing tax rebates and quality bonuses. |
| `production-insurance.js` | Completion Bonds | Risk mitigation policies (Overrun Shield, Key Cast Indemnity, Full Completion Bond) against budget spikes. |
| `awards-campaign.js` | FYC Lobbying Campaign | For Your Consideration trade advertising, screener mailings, voter receptions, and guild momentum tracking. |
| `board-targets.js` | Board of Directors Mandates | Quarterly board directives, studio confidence index (0-100%), executive bonuses, and austerity budget caps. |
| `fan-conventions.js` | Convention Fan Showcases | Comic-Con Hall H and Worldwide D23 presentations, studio fan club membership tiers, opening buzz spikes. |
| `test-screenings.js` | Test Screenings & Reshoots | Focus group audience cards, pacing ratings, tracking legs estimation, and post-production emergency reshoots. |
| `studio-espionage.js` | Covert Intelligence Desk | Clandestine surveillance, rival slate infiltration, talent contract expiration theft, counter-PR media leaks. |
| `merch-licensing.js` | Franchise Merchandising | Product lines (Toys, AAA Video Games, Apparel, Theme Parks), upfront licensee advances, weekly royalties. |
| `territory-licensing.js` | Foreign Pre-Sales Desk | International territory distribution deals, minimum guarantees, regional box office royalty sharing. |
| `custom-sandbox.js` | Sandbox & Holiday Engine | Custom studio, talent, and rival creator tools, 52-week holiday corridors, custom release calendars. |
| `v31-features.js` | Crisis PR & Agency Packaging | Crisis PR containment desk (4 response protocols), elite agency packaging (CAA/WME/UTA) with packaged discounts. |
| `finance-tools.js` | Corporate Finance Suite | Detailed weekly P&L ledgers, 12-week cashflow forecasting, mezzanine debt facilities, and CSV financial exports. |
| `challenge-leaderboard.js` | Seeded Challenge Engine | Deterministic weekly scenario seeds, standardized challenge scoring, and shareable studio performance codes. |
| `theater-chains.js` | Theatrical Exhibition Networks | Independent exhibitor relations, premium format splits (IMAX, Dolby Cinema), and concession revenue sharing. |
| `dynamic-soundtrack.js` | Adaptive Audio Atmosphere | Synthesized Web Audio soundtrack that responds dynamically to studio cash solvency, box office hits, and crises. |
| `dynasty-legacy.js` | Multi-Generational Legacy | Post-retirement dynasty bonuses, family trust fund generation, heirloom studios, and generational succession. |
| `bow-shorts.js` | Short-Form Digital Media | Episodic streaming shorts, viral digital content, social platform monetization, and rising talent discovery. |
| `talent-agency.js` | In-House Agency Operation | Establish a proprietary studio talent agency, manage client rosters, collect commission fees, and train stars. |

---

## Reference Parity Breakdown

Box Office War synthesizes gameplay systems from classic business simulations into a coherent, modern framework:

### Box Office Inc Parity
- **Hollywood Talent Agencies**: Tiered agency representation (CAA, WME, UTA) with packaged star bundles and volume commission structures.
- **International Pre-Sales**: Regional minimum guarantees (MG) that offset production exposure before principal photography wraps.
- **Crisis Media Spin**: Formal PR war room protocols to navigate talent scandals without scrapping multimillion-dollar productions.

### Box Office Sim 2 Parity
- **Box Office Clash Radar**: Direct computation of screen cannibalization between competing releases sharing identical demographic quadrants.
- **Dynamic Decay Curves**: Realistic box office legs calculated from the spread between critical reviews and audience exit-poll word of mouth.
- **Windowing Tradeoffs**: Explicit choice between 17-day, 45-day, and 90-day theatrical windows with exhibitor relation consequences.

### Silver Screen Story Parity
- **Lot Infrastructure Development**: Permanent physical upgrades to production lots including soundstages, digital mixing suites, and backlots.
- **Theme and Genre Chemistry**: Hidden synergies between 266 genre and theme pairings discovered through production experience.
- **Talent Progression**: Directors and actors earn XP on every shoot, leveling up technical execution, charisma, and speed attributes.

### TV Studio Story Parity
- **24/7 Linear EPG Grid**: 24-hour programming grid scheduling across 8 television networks with format blocks and prime-time ad rates.
- **Broadcast Syndication**: Secondary broadcast rights monetization for catalog films past their primary theatrical and streaming cycles.

---

## Installation & Deployment

### Web Application (PWA)
Box Office War runs directly in any modern web browser without dependencies or build steps:
```bash
# Serve locally using any static web server
python3 -m http.server 8080
# Open http://localhost:8080 in Chrome, Safari, Firefox, or Edge
```

### Android APK (v32.3)
1. Download the latest signed release APK from [GitHub Releases](https://github.com/pjneha66/Box-office-War/releases/latest).
2. Install the APK on your Android device (Android 8.0 Oreo or higher supported).
3. The application operates 100% offline, caching all scripts, audio synthesis engines, and SVG assets locally.

### Building the Android APK from Source
Prerequisites: Node.js 18+, JDK 21, and Android SDK command-line tools.
```bash
# 1. Prepare web bundle into apk/www
node apk/build-www.js

# 2. Synchronize web assets with Capacitor Android
cd apk
npx cap sync android

# 3. Compile release APK with Gradle
cd android
./gradlew assembleRelease --no-daemon

# The signed release APK will be generated at:
# apk/android/app/build/outputs/apk/release/app-release.apk
```

---

## Test Suite & Verification

The project enforces automated test coverage across headless economic simulations, full UI state verification, and long-range scenario balance:

```bash
# Execute entire test suite
npm test

# Run individual test harnesses:
npm run test:engine     # Headless 5-year economy simulation (smoke.js)
npm run test:ui         # Full UI click-through & modal interactions (ui-test.mjs)
npm run test:balance    # Economy invariants across 6 seeds x 120 weeks (balance.js)
npm run test:scenarios  # Automated 200-week playthroughs for all 5 scenarios (scenario-playthrough.mjs)
npm run test:library    # Catalog and M&A bulk action validations (verify-library.mjs)
npm run validate:slots  # Save slot structural validation (validate-slots.js)
```

---

## Architecture & Design Principles

- **Zero Framework Overhead**: Written in standard, high-performance vanilla JavaScript (ES6+), semantic HTML5, and pure CSS custom properties (`design-tokens.css`).
- **Deterministic State Serialization**: All game state is encapsulated in a single global object `G`, validated via schema migrations (`migrateSave`), and serialized to browser `localStorage` and `IndexedDB`.
- **Keyboard Power Tools**: Built-in Command Palette (`Cmd+K` / `Ctrl+K`), arrow-key grid navigation, and comprehensive keyboard shortcuts for high-speed management.
- **Accessibility & Internationalization**: Screen-reader live regions (`role="status"`, `role="alert"`), system motion preference detection (`prefers-reduced-motion`), and full English / Hindi localization dictionaries.

---

## License

MIT License. Open source for modification, study, and distribution.
