# 🎬 Box Office War

> **A deep Hollywood tycoon sim — run a studio, build franchises, launch your own streamer, and dominate the global box office.**

[![Live Demo](https://img.shields.io/badge/▶%20Play%20Now-box--office--war.vercel.app-black?style=for-the-badge&logo=vercel)](https://box-office-war.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Smoke%20Tests-Passing%20✅-brightgreen?style=for-the-badge)](#-development)

---

## 🎮 What is Box Office War?

Box Office War is a **browser-based Hollywood studio management game** — no installs, no accounts, fully offline-capable as a PWA. You start with a modest production budget and must grow a global entertainment empire: greenlight films, sign talent, launch a streaming service, build theme parks, manage rival studios, and chase Oscar glory.

Every decision compounds. A hit creates a franchise. A franchise funds a park. A park finances your next tentpole. Mismanage cash flow and the bank takes the lot.

---

## 🆕 v28.x — The Big Update Wave (Oct 2026)

**v28 — Reference Update** — studied four reference tycoon games (see [REFERENCE-NOTES.md](REFERENCE-NOTES.md) — mechanics only, all code original):

- **🎭 Talent Abilities** — every actor, director, writer and producer can carry a hidden, rarity-tiered ability (Crowd-Pleaser → Movie Star Incarnate) that quietly bends quality, openings, legs, international share, overruns and award odds. **Audition reads** (3% of fee) reveal them early; otherwise one film together does.
- **🎨 Themes & Combo Discovery** — attach a theme at greenlight; hidden genre×theme affinities are remembered the moment you ship a pairing (⭐ great match: +5 quality, +8% opening · ✖ clash: −4). Browse the full **🧩 Combos Codex** (266 pairings) in Develop.
- **🎪 Festival Entry Modes** — per festival choose **World Premiere**, **Competition** (film must have shot in the festival's home region; ×1.6 prestige), or **Market Auction** (rival studios bid real money for the finished picture — cash and rep now, they keep the film).
- **🌍 IP Transfer Market** — rivals make buy-out offers on your franchises (sell = cash now, lose merch/park income); rival-held **legacy franchises** surface for sale mid-run with a built-in fanbase.
- **⭐ Watchlist & 📜 Active Deals** — pin talent from any profile; the talent hub tracks your watchlist and every running multi-film deal.

**v28.1–v28.10 — Prototype, hardening & polish:**

- **📊 RPG prototype complete** — balance pass (XP curve 1.15, all 6 life-event families firing), live **debug panel (Ctrl+Shift+P)**: XP curve, event weights, equipment multipliers, quick actions. Go/No-Go: **GO** ([decision doc](.opencode/plans/go-nogo-prototype.md)), tagged `prototype-v1`.
- **📱 Full mobile pass** — P0 bugs fixed (consolidated breakpoints, hover rules gated to `@media(hover:hover)`, long-press fast-forward), P2 layout leftovers, P3 perf (backdrop-filter → solid backgrounds on phones), P4 polish (`.sr-only`, coach marks). Service worker now **auto-updates every release** (v20 cache — no manual refresh needed).
- **⌨️ Power tools** — ⌘K/Ctrl+K **command palette**, arrow-key tab & grid navigation, hardened modal focus (auto-focus + restore), COPPA age gate, Enter/Space activation on HUD chips.
- **✨ Custom Creator** — invent your own studios, people and franchises from the Develop tab; custom people join the real talent pool, custom studios seed rival co-production deals, custom franchises appear in the IP Market.
- **🗺 Deeper sim** — per-region star power (NA/EU/AS/LA/AF), contracts that expire by weeks *or* films, **📖 M&A library browser** (sortable vault with value breakdown) + 🪙 firesale counter-offers, research % progress bars, finance transaction search, §15 streamer sub-tabs (Home/Originals/Deals/Sports/Market).
- **🧪 Test suite grown** — smoke + 60+ UI steps + balance harness + **automated scenario playthroughs (5 scenarios × 200 weeks, all pass)** + 13/13 save-slot validation, zero flakes.
- **📸 Store-ready** — PWA PNG icons (512/192/180) + rendered store screenshots in `assets/store/`.

## ✨ Feature Highlights (v16)

### 🎬 Core Film Production
- **Greenlight wizard** — pick genre, scale, format (standard / premium / IMAX / 3D), writer, director, cast & producer; set budget and production market
- **Script & IP market** — rotating script pitches with genre/quality signals; bid on IP licenses (books, comics, games, real events)
- **Shooting locations** — Atlanta / London / Australia rebates that pay weekly during the shoot
- **MPAA ratings** — PG-13 vs R cuts affect audience size and word-of-mouth
- **Test screenings & reshoots** — pay to iterate on rough-cut scores before wide release
- **Release dating** — date-picker with rival tentpoles, holidays and genre clutter priced in
- **Marketing** — Super Bowl spots, influencer junkets, review-embargo plans, BTL spend

### 🌍 Box Office & Distribution
- **17 / 45 / 90-day theatrical windows** — exhibitor-relations meter, PVOD vs streaming tradeoffs
- **Wide vs platform release patterns** — staggered international rollouts, foreign-language bonuses
- **Box-office legs** — genre-specific decay curves, critic + audience score split, 4-week chart
- **Library re-releases** — 104-week cooldown, classic re-releases
- **Reboots & sequels** — franchise reboot with data-driven fatigue meter; sequel greenlight from game studio

### 📺 OTT & Streaming
- **Your own streamer** — subs, ceiling, churn, day-and-date releases, library moves
- **Subscription tiers** — ad-supported vs premium, tier upgrades
- **Live sports rights** — esports, wrestling and sports slate auctions
- **Reality / documentary / limited series** — separate production lane
- **Output deals & rival platforms** — other studios enter the streaming market

### 🏰 Empire Building
- **Franchise lifecycle** — merch lines, theme parks → resort districts, DTV sequels, TV spin-offs, publishing arms
- **Shared universes** — one-time crossover weave gives +15% franchise income forever
- **Brand collabs & licensing-out** — seasonal toy spikes, licensing partners
- **🕹 Game Studio (v16 NEW)** — commission a licensed game from your franchises; manage dev, launch, score reviews, earn royalties, and greenlight sequels

### 🧑‍🤝‍🧑 Talent & Agencies
- **Three talent agencies** — Meridian / Crown / Sterling with exclusive rosters, packaging fees, first-look deals
- **Yearly "New Faces" classes** — discover rising stars before they cost a fortune
- **Loyalty discounts** — repeat collaborators come cheaper
- **Star poaching & rehab arcs** — toxic-star scandals, career fade, comeback fund, cameo offers, concert tours
- **📬 Fan Mail (v16 NEW)** — inbox of fan letters (love mail, angry mail, subscriber mail); reply to boost rep or ignore at your peril

### 🎖 Board, Execs & Rivals
- **🏛 Board of Directors (v16 NEW)** — 100-point approval score; hit milestones to keep the board happy or face pressure events; hire up to 3 executives (CMO / CFO / Casting Director) each with passive perks and level-up paths
- **🕵 Rival Studios (v16 NEW)** — live scoreboard of competing studios; intel system (plant a mole, buy reports); rival AI takes real turns each week; fork rival strategy with your own counter-play
- **📈 Social Trending (v16 NEW)** — Twitter-style trending ticker showing #Hashtags for your films and events; promo campaigns convert trending buzz into opening-weekend spikes

### 🏆 Awards
- **Precursor awards** — Guilds, Critics Circle, Indies stack momentum into Oscar night
- **FYC campaign slider** — $2–20M spend; Best Picture win triggers a +25%-of-P&A re-release
- **Festival circuit** — four named festivals with genre tastes, prestige levels, and acquisitions frenzy

### 💼 Finance
- **Weekly P&L** — box-office rentals, streaming revenue, merch & park income, loan interest
- **12-week cash-flow forecast** — with scenario sliders
- **IPO & stock price** — shareholders judge quarterly earnings calls
- **Loans & mezzanine debt** — credit line, covenant breach risk
- **M&A desk** — acquire rival slates, IP libraries, mini-streamers (rotating deal book)
- **Export ledger as CSV** — download your full financial history
- **Tax credits & guild contracts** — jurisdiction rebates, guild strike meter

### 🏴‍☠️ Piracy & Windowing
- Studio piracy meter bleeds live theatrical runs
- Anti-piracy upgrade (deploy once per game)
- Windowing choices trade OTT speed for theatrical protection

### 🎯 Scenarios & Meta
- **Scenarios** — Standard / Turnaround / Golden Age / Indie Darling / Franchise Machine
- **Difficulty levels** — Easy / Normal / Hard with sandbox mode
- **30+ Achievements** — box-office, streamer, awards, empire & specialist feats
- **3 Save slots** — export/import portable save codes, full schema migration chain (v1 → v8)
- **Interactive tutorial** — 5-step banner walks your first film from script to receipts; pays +1 rep on completion

### 📱 UX & Accessibility
- **PWA** — installable, fully offline (cache-first service worker)
- **Dark cinematic theme** — responsive; mobile bottom-nav, desktop tab bar; swipe between tabs
- **Pull-to-advance** — pull down at top of feed to advance a week on mobile
- **Haptic rumbles** — on hits/flops (toggleable)
- **Reduced-motion** — Auto / On / Off; confetti is motion-aware
- **Text size control** — Small / Medium / Large preview in Settings
- **🌐 Hindi / English toggle** — full i18n dictionary

---

## 🖥 Screens

| Tab | Contents |
|-----|----------|
| 🏛 **Studio** | Feed, market-share pie, festivals/FYC campaigns, achievements, share card, trending ticker |
| 📝 **Develop** | Genre trend board, script market, IP market, writers/producers/directors/cast, talent business |
| 🎬 **Productions** | Pipeline, rewrites, test screenings & reshoots, release dating, release scheduler |
| 📊 **Box Office** | Weekly chart, runs, critic/audience split & reviews, library, re-releases/reboots |
| 📺 **OTT & Series** | Your streamer + tiers, sports rights, offers, rival platforms |
| 🏰 **Empire** | Franchises, merch, parks, lifecycle, shared-universe weave |
| 🕹 **Games** *(v16)* | Game studio — dev pipeline, launch events, review scores, sequels |
| 📬 **Fans** *(v16)* | Fan-mail inbox — love/angry/subscriber letters, read-all, reply actions |
| 🏛 **Board** *(v16)* | Board approval meter, milestone tracker, executive hiring & levelling |
| 🕵 **Rivals** *(v16)* | Rival scoreboard, intel system, mole plant, counter-strategy fork |
| 💼 **Finance** | Live P&L, 12-week forecast, loans, mezzanine, IPO, execs, upgrades, CSV export |

---

## 🕹 Quick Strategy Tips

0. Read the **genre trend board** before you buy a script — a red-hot genre is worth more than a star.
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Pick your distribution: theatrical for upside, **streaming original** for guaranteed cash, or keep options open.
3. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
4. **Horror** has the best ROI per dollar; **animation** has the best legs (and the best merch); **drama** wins awards.
5. A hit film (2× breakeven + good reviews) unlocks a **franchise** — sequels open ~35% bigger.
6. Cash-strapped? **International pre-sales** pay ~22% of budget on day one (you give up intl box office).
7. Watch **Finance → This week's P&L**: box-office rentals land every week a film is in theaters.
8. Always attach a **producer** on anything over $50M — overruns compound faster than interest.
9. Rest a franchise when fatigue passes ~30% — sequels into fatigue open small and review badly.
10. At **rep 40** launch your own streamer and feed it with library moves and day-and-date releases.
11. Windows matter: **17-day** boosts PVOD but angers exhibitors; **90-day** does the reverse.
12. Watch **Finance → Forecast** and hire a **CFO** before you stack debt.
13. Keep the **Board approval** above 50 — dropping below triggers pressure events that cost cash and rep.
14. Check the **Rivals** tab weekly — knowing what the competition is greenlighting helps you counter-schedule.
15. Commission a **game** for your top franchise — royalties compound for years with no extra headcount.

---

## 🛠 Development

### File Structure

```
index.html              Shell (start screen + app scaffolding + modal scaffolds)
style.css               Dark cinematic theme, responsive (mobile bottom-nav / desktop tabs)
data.js                 Genres, scales, calendar, OTT platforms, talent pools, critics, trends,
                        tiers, events, scenarios, achievements, agencies, AI/co-production/
                        piracy/guild/M&A configs, festival circuit, tutorial steps,
                        game-studio data, fan-mail templates, board/exec defs
                        (DATA.SAVE_VERSION — bump + add migration step for schema changes)
engine.js               The simulation: quality, hype, legs, splits, offers, rivals, awards +
                        precursors, finance, streamer, sports, lifecycle, stock, trends,
                        piracy, guilds, M&A, AI scandals, empire/licensing,
                        game-studio lifecycle, fan-mail system, board/exec mechanics,
                        social-trending engine, anti-piracy deploy, exportLedgerCSV,
                        schema v8 save migration
ui.js                   Rendering, wizards, modals (auction/deepfake/FYC/empire/settings/
                        help/game-over), toasts, WebAudio stings + haptics,
                        confetti (motion-aware), studio card, i18n, achievements, tutorial,
                        touch gestures, viewGames, viewFans, viewBoard, viewRivals,
                        viewFinance panels, piracy meter, prod-filter chips, trending ticker
i18n.js                 Hindi/English dictionary + chrome translation
icon.svg                PWA icon
manifest.webmanifest    PWA manifest
sw.js                   Service worker (offline cache-first)
test/smoke.js           Headless 5-year economy simulation runner
test/smoke-body.js      Smoke assertions (node test/smoke.js)
test/ui-test.mjs        jsdom click-through of the full game flow
test/balance.js         Balance harness (6 seeds × 120 weeks, progression + economy invariants)
test/scenario-playthrough.mjs  Automated playthroughs — 5 scenarios × 200 weeks, win-tracking
test/verify-library.mjs Acquired-library bulk actions (sell outright / bulk license / flip)
test/validate-slots.js  Save-slot count validation
```

### Running Tests

```bash
# Everything: smoke + UI click-through + balance + scenario playthroughs
npm test

# Individually
npm run test:engine     # headless 5-year economy simulation
npm run test:ui         # full UI click-through (requires jsdom)
npm run test:balance    # balance harness (6 seeds × 120 weeks)
npm run test:scenarios  # 5 scenario playthroughs × 200 weeks
npm run test:library    # M&A vault bulk actions
npm run validate:slots  # save-slot validation
```

### Balance Target

An average tentpole opens ~$125M domestic; disciplined slates compound; reckless leverage kills you in about a year.  
Tuned via headless Monte-Carlo runs — healthy studios reach **$1–2B cumulative WW gross** over 5 years.

---

## 🚀 Deploy Your Own

This is a **static site** — just serve `index.html` and its siblings.

### Vercel (one command)
```bash
npx vercel --prod
```

### GitHub Pages
Push to your repo and enable Pages from `Settings → Pages → Deploy from branch (main / root)`.

### Any static host
Upload all files (no build step needed).

---

## 📄 License

MIT — have fun, fork it, reskin it.
