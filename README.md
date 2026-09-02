# 🎬 Box Office War — Movie & Series Studio Tycoon

A realistic **movie-business simulation game** that runs in any browser — phone, tablet, or PC. No installs, no dependencies, no server: it's pure HTML/CSS/JS and works offline (just open `index.html`).

> Found a studio. Greenlight films. Date them like a pro. Survive the box office. Cash the OTT checks. Win awards. Build franchises. Launch your own streamer. Don't go bankrupt doing it.

## ▶ How to run

- **Easiest:** double-click `index.html` (yes, `file://` works).
- **Or serve it:** `python3 -m http.server 8080` → open `http://localhost:8080`.
- **Install as an app:** it's a PWA — in Chrome/Edge use *Install*, then play fully offline.
- **On mobile:** host the folder anywhere static (GitHub Pages works) — the UI is fully responsive with a bottom tab bar.

Progress auto-saves to your browser's localStorage — into **3 save slots**, with **export/import codes** to move a studio between devices.

## 🎮 What's in the game

### The realistic business model
| Mechanic | Real-world rule used |
|---|---|
| Opening weekend | star power × marketing (P&A) × release corridor × competition vs rival studios |
| Legs (total ÷ opening) | driven by quality — horror opens big & dies fast; animation runs for months |
| Revenue splits | studio keeps ≈53% domestic / ≈42% international (blended, incl. China's ~25%) |
| Weekly cash flow | box office rentals (~53% of domestic gross) paid **every week a film plays**; every dollar itemized in a live P&L |
| Windows & ladder | theatrical → PVOD → pay-1 TV (lands 6% of WW at week +6); 17/45/90-day windows trade PVOD for exhibitor goodwill |
| Distribution choice | theatrical, streaming original (auction on delivery), or decide later; finished films shoppable anytime |
| OTT deals | post-run licenses, pre-buys, output deals (+20% on next 3 sales), bidding wars you can counter |
| Series | pitch → greenlight → license ≈115% of budget → buzz → renewals; reality/documentary are cheap & renew-friendly; limited events renew harder |
| Franchise empire | hits unlock franchises: sequels, spin-offs (45% budget), merch, games, parks, resorts, publishing — with visible **brand heat & fatigue** |
| Your own streamer | launch at rep 40 ($250M); subs pay weekly, grow toward a content ceiling, churn when starved; day-and-date & library moves feed it |
| Live sports | quarterly sealed-bid auctions (soccer, hoops, racing, fights) buy instant subscribers + ceiling |
| Talent economics | A-list backend points, intl pre-sales, filming rebates, loyalty discounts, poaching, cameos, toxic stars, career fade |
| Seasons & inflation | summer/holiday corridors multiply openings; the whole market compounds +2%/yr |
| Awards | 4 festivals a year + FYC campaigning + the year-end Golden Reels |
| Everything else | rival slates, loans + mezzanine debt, executives, IPO, random events, achievements |

### Screens
🏛 Studio (feed, market share, festivals/FYC, achievements) · 📝 Develop (scripts, IP market, talent & talent-business) · 🎬 Productions (pipeline, rewrites, test screenings, release dating) · 📊 Box Office (chart, runs, library, re-releases/reboots) · 📺 OTT & Series (your streamer, sports, offers, platforms) · 🏰 Empire (franchises & lifecycle) · 💼 Finance (live P&L, forecast, loans, executives, IPO)

## 🆕 What's new in the v2/v3 expansion

**Content & creative** — script rewrites, MPAA rating (PG-13 vs R), test screenings & reshoots, Premium/IMAX formats, shoot-location rebates (Atlanta/London), foreign-language films, soundtrack gambles, cameos, China censor-board risk.

**Talent & people** — yearly "New Faces" classes, loyalty discounts on repeat collaborators, star poaching, Discovery of the Year, auteurs (no sequels), toxic-star rehab arcs, career fade.

**Box office & distribution** — release-date chicken (rivals blink), 17/45/90-day windows + exhibitor-relations meter, wide vs platform patterns, staggered intl rollouts, library re-releases (104-wk cooldown), reboots.

**OTT & streaming** — your **own streamer** (subs, ceiling, churn, day-and-date, library moves, 25M-sub achievement), live sports rights auctions, reality/documentary & limited series, auction counters, output deals, rival platforms entering the market.

**Franchise & empire** — spin-offs, shared universes (+15% forever), crossover events (+45% buzz), DTV sequels, TV spin-offs & film continuations, brand collabs, licensing-out, resorts & cruises, publishing arms, holiday toy spikes.

**Business & finance** — IPO ($400M, shareholders judge quarters), mezzanine debt, CMO/casting/CFO executives, 12-week cash-flow forecast, wrap deals, agency exclusives.

**Meta & UX** — 15 achievements, 3 scenarios (Standard/Turnaround/Golden Age), 3 difficulties, sandbox mode, 3 save slots, export/import codes, 🌐 Hindi/English toggle, text-size control, auto-play weeks, PWA install + offline.

## 🕹 Quick strategy tips
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Pick your distribution: theatrical for upside, **streaming original** for guaranteed cash, or keep options open.
3. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
4. Horror is the best ROI per dollar; animation has the best legs (and merch); drama wins awards.
5. A hit film unlocks a **franchise** — sequels open bigger, spin-offs are cheap, merch & parks pay weekly.
6. At **rep 40** launch your own streamer and feed it: library moves and day-and-date releases grow subs.
7. Windows matter: 17-day boosts PVOD but angers exhibitors; 90-day does the reverse.
8. Watch **Finance → forecast** and hire a CFO before you stack debt.

## 🛠 Development

```
index.html      shell (start screen + app)
style.css       dark cinematic theme, responsive (mobile bottom-nav / desktop tabs)
data.js         genres, scales, calendar, OTT platforms, talent pools, titles, events, achievements, scenarios, difficulty
engine.js       the simulation (quality, hype, legs, splits, offers, rivals, awards, finance, streamer, sports, lifecycle)
i18n.js         Hindi/English dictionary + chrome translation
ui.js           rendering, wizards, modals, settings, achievements, toasts, WebAudio bleeps
icon.svg /      PWA icon + manifest + service worker (offline cache-first)
manifest.webmanifest / sw.js
test/smoke.js   headless 5-year economy simulation (node test/smoke.js)
test/ui-test.mjs jsdom click-through of the full game flow (npm i jsdom; node test/ui-test.mjs)
```

Balance target: an average tentpole opens ~$125M domestic; disciplined slates compound; reckless leverage kills you in about a year. Tuned via headless Monte-Carlo runs (`test/smoke.js`) — healthy studios reach $1–2B cumulative WW gross over 5 years.

## 📄 License
MIT — have fun, fork it, reskin it.
