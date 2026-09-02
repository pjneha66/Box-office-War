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
| Writers & producers | ✍️ screenwriters rewrite the script during pre-production (skill + genre fit move the script score — script is ~30% of quality); 🎞 producers' logistics shrink the weekly overrun risk on set, and great organizers trim a week off the shoot |
| Overruns | every week of shooting carries overrun risk (~5%/wk unproduced; ~1.5%/wk with a top producer) — storms, reshoots and flu cost real money, itemized in the P&L |
| Genre trends | audience taste cycles live: horror gets hot, musicals cool. Trends drift weekly, reshuffle each year, and spike via events — they move every opening weekend (yours and rivals'), and rivals lock their yearly slates chasing what's hot |
| Franchise empire | hits unlock franchises: sequels, 🧸 merch lines (3 tiers, weekly income), 🎮 game licenses (cash per tier), 🎡 theme parks (tier 2+, expansion) — releases re-heat the brand |
| Franchise fatigue | over-milked brands wear out: quick follow-ups drop the sequel opening boost from ×1.35 toward ×1.05; rest a brand ~18 months and nostalgia recharges it |
| Talent careers | stars fade when idle (cheaper fees — and a comeback if you cast them in a good film), veterans retire with a headline, new names arrive weekly |
| Talent economics | A-list ensembles take 5% backend points off rentals; international pre-sales raise instant cash at greenlight (forfeits intl box office); productions earn filming rebates weekly |
| Seasons | summer/holiday corridors multiply openings; January & September are graveyards |
| Awards | year-end Golden Reel — Best Picture wins add re-release gross, reputation, catalog value |
| Feel | WebAudio stingers (opening fanfare, ka-ching deals, award drum roll, slate clap), animated charts, confetti on smash hits |
| Everything else | rival studios with their own slates, loans with weekly interest, studio upgrades, random events (strikes, piracy, pandemics, streaming wars, genre waves) |

### Screens
🏛 Studio (feed + market share) · 📝 Develop (script market + talent) · 🎬 Productions (pipeline + release dating) · 📊 Box Office (weekly chart, runs, library) · 📺 OTT & Series (offers, renewals, platforms) · 🏰 Empire (franchises, merch, parks) · 💼 Finance (live weekly P&L, loans, upgrades)

## 🕹 Quick strategy tips
1. Start with an **indie or mid film** — tentpoles need ~$200M+ and a franchise to pay off.
2. Pick your distribution: theatrical for upside, **streaming original** for guaranteed cash, or keep options open and shop it later.
3. **Check the Market pulse** (Studio tab) before you greenlight: a hot genre multiplies your opening, a cold one wastes a good film. And date before the wave breaks.
4. Hire a **screenwriter** whose specialty matches the script — a great rewrite is the cheapest quality you'll ever buy. Shoot without a **producer** and you're paying a weekly overrun tax.
5. Never release a genre film into a rival tentpole's weekend — check the dating calendar.
6. Horror is the best ROI per dollar; animation has the best legs (and the best merch); drama wins awards.
7. A hit film (2× breakeven + good reviews) unlocks a **franchise**. Sequels open bigger — but milk it and fatigue sets in. Rest a brand ~18 months and it comes back charged.
8. Cash-strapped? **International pre-sales** pay ~22% of budget on day one (you give up intl box office), and filming rebates arrive weekly during the shoot.
9. **Faded stars are cheap** — cast one in a well-reviewed film and you get a comeback, their power back, and the credit (plus rep).
10. Watch **Finance → This week's P&L**: box office rentals land every week a film is in theaters.
11. Loans bridge production gaps; net debt beyond your credit line for 3 weeks = the bank takes the lot.

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

**Saves:** versioned (`v2`) with automatic migration on load — older `v1` saves keep working (trends, careers and crew fields are backfilled), and corrupt blobs are rejected cleanly instead of bricking the start screen.

### 🗺 Roadmap (not yet in)
M&A / acquiring rivals & streamers · named critics & review bombing · film markets (Marché/AFM) & intl co-productions · ad-tier vs premium streamer strategy · dev-your-own video games · post-IPO stock price & earnings calls · slate co-financing & write-downs · LBO/"vulture" events · share-your-studio card · more genres (western, war, sports…). Ideas welcome.

## 📄 License
MIT — have fun, fork it, reskin it.
