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

### The v2 production & release craft update
| Mechanic | Real-world rule used |
|---|---|
| Script rewrites | pay for extra polish in pre-production (+6 script score, +1 wk pre-prod, ~40% of dev rights) |
| MPAA rating choice | 🎬 PG-13 for the masses vs **R** (−12% opening, critics +5) |
| Test screenings & reshoots | screen a finished film, then reshoot weak spots (~12% of budget, +2–4 wks, big quality jump) |
| Premium/IMAX formats | +12% opening for +8% P&A — pick it when you set the release date |
| Shoot locations | 🌍 Los Angeles (0%), Atlanta (14%), London (18%) — the rebate offsets the weekly burn |
| Executive hires | 👔 CMO (+12% hype), Head of Casting (−10% fees), CFO (−30% interest) |
| Mezzanine debt | 🪜 emergency money at 0.5%/wk (≈26%/yr), no credit-line cap |
| IPO | 📊 raise $400M at reputation ≥60; shareholders punish loss-making quarters |
| Yearly talent class | 🌟 fresh faces hit the market every year ("New Faces of Year N") |
| 2% yearly inflation | the whole market compounds ~2%/yr (budgets, offers & gross all scale) |
| 12-week cash-flow forecast | 📈 Finance shows a rough 12-week projection of income vs commitments |

### The v3 Studio-as-Empire update
| Mechanic | Real-world rule used |
|---|---|
| Your own streamer | 📱 build a platform ($250M, rep ≥40). Subs pay $0.5/sub/wk; **subscriber ceiling** grows from your library, franchises, shows & sports |
| Churn | starve the service and subs bleed (0.8%/wk) |
| Day-and-date releases | 🎞 in theaters *and* on your streamer: −35% opening, +subs |
| Library moves | push any unsold film onto your platform |
| Live sports rights | 🏆 quarterly sealed-bid auctions (weeks 13/26/39/52) for soccer/hoops/racing/fights ($70–170M); instant sub bumps + sports power that raises your ceiling (decays ~1.5%/wk) |
| Theatrical windows | 17 / 45 / 90-day: short = +15% PVOD, long = −15% PVOD |
| Exhibitor relations meter | 🎞 short windows anger exhibitors; the meter swings openings ±5% |
| PVOD → pay-1 TV ladder | pay-1 lands 6% of WW at week +6 after the run |

### The v4 Craft, Cycles & Consequences update
| Mechanic | Real-world rule used |
|---|---|
| ✍️ Writers | attach a writer at greenlight: skill + genre fit adds up to **+11 script**, and script is 30% of quality |
| 🎫 Producers | they contain **cost overruns** (odds & size), add production value, and a great one shaves a week off the shoot — go without and every overrun is yours |
| 📈 Genre trends | every genre carries a heat multiplier (0.78–1.28×) that re-rates **every quarter**; heat moves opening weekend and streaming appetite, hits warm a genre, flops cool it |
| 🗞 Named critics | five named reviewers (own outlet, harshness, genre loves/hates) publish on opening day — their consensus becomes the critic score |
| 🍅 Critic/audience split | separate critic & audience meters; **review bombing** events tank the audience score and the legs that come with it |
| 😴 Franchise fatigue | each entry adds fatigue: smaller openings *and* worse reviews, healed only by resting the brand ~6 months |
| 👵 Talent careers | everyone ages: skill peaks in the 30s–40s, star power fades late, veterans **retire**, scandals make talent radioactive (cheap to hire, −opening) and a **comeback** event can rehabilitate them |
| 🎬 New genres | western, war, sports, concert film and true-crime docudrama, each with their own legs, intl mix and merch |
| 💸 Streamer tiers | premium-only ($0.50/sub/wk) vs **ad tier + premium** (−24% ARPU, +32% ceiling, stickier) — plus a **password-sharing crackdown** event |
| 📊 Post-IPO stock | a real share price, market cap, quarterly **earnings calls** (beat/miss vs the street), named analysts, downgrade streaks and **secondary offerings** |
| 🤝 Co-financing | a partner covers 30% of a production for 35% of its net |
| 🔊 Sound & motion | WebAudio stings — opening fanfare, cash register, award timpani, smash-hit chime, downgrade buzzer — plus animated chart bars and **confetti** on smash hits and Best Picture |
| 📸 Studio card | generate a shareable PNG snapshot of your studio (or copy the summary) |
| 💾 Save safety | versioned save schema with **validation + forward migrations**; corrupt saves are quarantined instead of crashing the game |

### Screens
🏛 Studio (feed, market share, festivals/FYC, achievements, share card) · 📝 Develop (genre trend board + script market + IP market + writers/producers/directors/cast + talent-business) · 🎬 Productions (pipeline, rewrites, test screenings & reshoots, release dating) · 📊 Box Office (weekly chart, runs, critic/audience split & reviews, library, re-releases/reboots) · 📺 OTT & Series (your streamer + tiers, sports, offers, platforms) · 🏰 Empire (franchises, merch, parks, lifecycle) · 💼 Finance (live weekly P&L, 12-week forecast, loans, mezzanine, IPO + stock price, execs, upgrades)

## 🆕 What's new in the v2/v3 expansion

**Content & creative** — script rewrites, MPAA rating (PG-13 vs R), test screenings & reshoots, Premium/IMAX formats, shoot-location rebates (Atlanta/London), foreign-language films, soundtrack gambles, cameos, China censor-board risk.

**Talent & people** — yearly "New Faces" classes, loyalty discounts on repeat collaborators, star poaching, Discovery of the Year, auteurs (no sequels), toxic-star rehab arcs, career fade.

**Box office & distribution** — release-date chicken (rivals blink), 17/45/90-day windows + exhibitor-relations meter, wide vs platform patterns, staggered intl rollouts, library re-releases (104-wk cooldown), reboots.

**OTT & streaming** — your **own streamer** (subs, ceiling, churn, day-and-date, library moves, 25M-sub achievement), live sports rights auctions, reality/documentary & limited series, auction counters, output deals, rival platforms entering the market.

**Franchise & empire** — spin-offs, shared universes (+15% forever), crossover events (+45% buzz), DTV sequels, TV spin-offs & film continuations, brand collabs, licensing-out, resorts & cruises, publishing arms, holiday toy spikes.

**Business & finance** — IPO ($400M, shareholders judge quarters), mezzanine debt, CMO/casting/CFO executives, 12-week cash-flow forecast, wrap deals, agency exclusives.

**Meta & UX** — 15 achievements, 3 scenarios (Standard/Turnaround/Golden Age), 3 difficulties, sandbox mode, 3 save slots, export/import codes, 🌐 Hindi/English toggle, text-size control, auto-play weeks, PWA install + offline.

## 🕹 Quick strategy tips
0. Read the **genre trend board** before you buy a script — a red-hot genre is worth more than a star.
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Pick your distribution: theatrical for upside, **streaming original** for guaranteed cash, or keep options open.
3. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
4. Horror is the best ROI per dollar; animation has the best legs (and the best merch); drama wins awards.
5. A hit film (2× breakeven + good reviews) unlocks a **franchise** — sequels open ~35% bigger, merch & parks pay weekly, and each release re-heats the brand.
6. Cash-strapped? **International pre-sales** pay ~22% of budget on day one (you give up intl box office), and filming rebates arrive weekly during the shoot.
7. Watch **Finance → This week's P&L**: box office rentals land every week a film is in theaters.
8. Always attach a **producer** on anything over $50M: overruns compound faster than interest.
9. Rest a franchise for two quarters when fatigue passes ~30% — sequels into fatigue open small and review badly.
10. At **rep 40** launch your own streamer and feed it: library moves and day-and-date releases grow subs.
11. Windows matter: 17-day boosts PVOD but angers exhibitors; 90-day does the reverse.
12. Watch **Finance → forecast** and hire a CFO before you stack debt.
13. Loans bridge production gaps; net debt beyond your credit line for 3 weeks = the bank takes the lot.

## 🛠 Development

```
index.html      shell (start screen + app)
style.css       dark cinematic theme, responsive (mobile bottom-nav / desktop tabs)
data.js         genres, scales, calendar, OTT platforms, talent pools, critics, trends, tiers, events, scenarios, achievements
                save schema version (DATA.SAVE_VERSION) — bump it and add a migration step
engine.js       the simulation (quality, hype, legs, splits, offers, rivals, awards, finance, streamer, sports, lifecycle, stock, trends)
ui.js           rendering, wizards, modals, toasts, WebAudio stings, confetti, studio card, i18n, achievements
i18n.js         Hindi/English dictionary + chrome translation
icon.svg /      PWA icon + manifest + service worker (offline cache-first)
manifest.webmanifest / sw.js
test/smoke.js   headless 5-year economy simulation (node test/smoke.js)
test/ui-test.mjs jsdom click-through of the full game flow (npm i jsdom; node test/ui-test.mjs)
```

Balance target: an average tentpole opens ~$125M domestic; disciplined slates compound; reckless leverage kills you in about a year. Tuned via headless Monte-Carlo runs (`test/smoke.js`) — healthy studios reach $1–2B cumulative WW gross over 5 years.

## 📄 License
MIT — have fun, fork it, reskin it.
