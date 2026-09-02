# 🎬 Box Office War — Movie & Series Studio Tycoon

A realistic **movie-business simulation game** that runs in any browser — phone, tablet, or PC. No installs, no dependencies, no server: it's pure HTML/CSS/JS and works offline (just open `index.html`).

> Found a studio. Greenlight films. Date them like a pro. Survive the box office. Cash the OTT checks. Win awards. Build franchises. Don't go bankrupt doing it.

## ▶ How to run

- **Easiest:** double-click `index.html` (yes, `file://` works).
- **Or serve it:** `python3 -m http.server 8080` → open `http://localhost:8080`.
- **On mobile:** host the folder anywhere static (GitHub Pages works) — the UI is fully responsive with a bottom tab bar.

Progress auto-saves to your browser's localStorage.

## 🎮 What's in the game

### The realistic business model
| Mechanic | Real-world rule used |
|---|---|
| Opening weekend | star power × marketing (P&A) × release corridor × competition vs rival studios |
| Legs (total ÷ opening) | driven by quality — horror opens big & dies fast; animation runs for months |
| Revenue splits | studio keeps ≈53% domestic / ≈42% international (blended, incl. China's ~25%) |
| Weekly cash flow | **box office rentals (~53% of domestic gross) are paid into funds every week a film plays**; intl rentals settle at run end; every dollar itemized in a live P&L ledger |
| Distribution choice | at greenlight: 🎥 theatrical, 📺 streaming original (platform auction on delivery), or decide later — finished films can be shopped to streamers anytime (3 platforms bid) |
| Windows | theatrical run → PVOD → streaming licensing |
| OTT deals | post-run licenses, pre-buys as "streaming originals", bidding wars you can counter |
| Series | pitch → platform greenlight → license ≈115% of season budget → buzz → renewal (or cancellation) |
| Franchise empire | hits unlock franchises: sequels, 🧸 merch lines (3 tiers, weekly income), 🎮 game licenses (cash per tier), 🎡 theme parks (tier 2+, expansion) — releases re-heat the brand |
| Talent economics | A-list ensembles take 5% backend points off rentals; international pre-sales raise instant cash at greenlight (forfeits intl box office); productions earn filming rebates weekly |
| Seasons | summer/holiday corridors multiply openings; January & September are graveyards |
| Awards | year-end Golden Reel — Best Picture wins add re-release gross, reputation, catalog value |
| Everything else | rival studios with their own slates, loans with weekly interest, studio upgrades, random events (strikes, piracy, pandemics, streaming wars) |

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

### Screens
🏛 Studio (feed + market share) · 📝 Develop (script market + talent + craft choices) · 🎬 Productions (pipeline, test screenings & reshoots, release dating) · 📊 Box Office (weekly chart, runs, library) · 📺 OTT & Series (offers, renewals, platforms) · 🏰 Empire (franchises, merch, parks) · 💼 Finance (live weekly P&L, 12-week forecast, loans, mezzanine, IPO, execs, upgrades)

## 🕹 Quick strategy tips
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Pick your distribution: theatrical for upside, **streaming original** for guaranteed cash, or keep options open and shop it later.
3. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
4. Horror is the best ROI per dollar; animation has the best legs (and the best merch); drama wins awards.
5. A hit film (2× breakeven + good reviews) unlocks a **franchise** — sequels open ~35% bigger, merch & parks pay weekly, and each release re-heats the brand.
6. Cash-strapped? **International pre-sales** pay ~22% of budget on day one (you give up intl box office), and filming rebates arrive weekly during the shoot.
7. Watch **Finance → This week's P&L**: box office rentals land every week a film is in theaters.
8. Loans bridge production gaps; net debt beyond your credit line for 3 weeks = the bank takes the lot.

## 🛠 Development

```
index.html      shell (start screen + app)
style.css       dark cinematic theme, responsive (mobile bottom-nav / desktop tabs)
data.js         genres, scales, calendar, OTT platforms, talent pools, title generators, events
engine.js       the simulation (quality, hype, legs, splits, offers, rivals, awards, finance)
ui.js           rendering, wizards, modals, toasts, WebAudio bleeps
test/smoke.js   headless 5-year economy simulation (node test/smoke.js)
test/ui-test.mjs jsdom click-through of the full game flow (npm i jsdom; node test/ui-test.mjs)
```

Balance target: an average tentpole opens ~$125M domestic; disciplined slates compound; reckless leverage kills you in about a year. Tuned via headless Monte-Carlo runs (`test/smoke.js`) — healthy studios reach $1–2B cumulative WW gross over 5 years.

## 📄 License
MIT — have fun, fork it, reskin it.
