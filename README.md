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
| Breakeven | ≈ (production budget + P&A) ÷ 0.48 worldwide gross |
| Cash flow | productions burn cash *weekly* (pre → shoot → post); talent fees & dev costs upfront |
| Windows | theatrical run → PVOD → streaming licensing |
| OTT deals | post-run licenses, pre-buys as "streaming originals", and bidding wars you can counter |
| Series | pitch → platform greenlight → license ≈115% of season budget → buzz → renewal (or cancellation) |
| Seasons | summer/holiday corridors multiply openings; January & September are graveyards |
| Awards | year-end Golden Reel — Best Picture wins add re-release gross, reputation, catalog value |
| Everything else | rival studios with their own slates, franchise/sequel economics, loans with weekly interest, studio upgrades, random events (strikes, piracy, pandemics, streaming wars) |

### Screens
🏛 Studio (feed + market share) · 📝 Develop (script market + talent) · 🎬 Productions (pipeline + release dating) · 📊 Box Office (weekly chart, runs, library) · 📺 OTT & Series (offers, renewals, platforms) · 💼 Finance (loans, upgrades, P&L)

## 🕹 Quick strategy tips
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
3. Horror is the best ROI per dollar; animation has the best legs; drama wins awards.
4. A hit film (2× breakeven + good reviews) unlocks a **franchise** — sequels open ~35% bigger.
5. Series are steady cash: deliver buzz above the platform's renewal line and margins grow each season.
6. Loans bridge production gaps; net debt beyond your credit line for 3 weeks = the bank takes the lot.

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
