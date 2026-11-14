# Box Office War — Simulation Core Audit

Scope: `engine.js` (9,895 lines) + `data.js` (2,099 lines), read in full; `ui.js` skimmed at engine call sites.
All money in $M. One global mutable state object `G`. No modules — every function is a browser global loaded via
script tags (`index.html:177-216`); `ui.js` calls `advanceWeek()`, `greenlight()`, `pitchFilm()`, `moveReleaseDate()`,
`legsOf()` etc. directly.

## 1. Weekly tick — `advanceWeek()` (engine.js:6076-6270)

Ordered pipeline, ~60 calls, most wrapped in `typeof fn==="function"` guards so optional feature files can be absent:

1. `G.week++`; reset `G.flash`, `G.weekTx` (per-week P&L ledger).
2. **Money first**: `tickFinance()` — overhead (`weeklyOverhead()`), loan interest `0.0018`/wk × `interestRate()` mult,
   mezzanine `0.005`/wk, investor debt $2.5M/wk, `libraryWeeklyIncome()` (`catalogValue*0.0045`). Cash<0 auto-converts to
   debt; net debt > `maxDebt()*1.15` for 3 weeks ⇒ bankruptcy `gameOver()`.
3. Pre-production systems: trends (`tickTrends`, quarterly), careers, contracts, research, fatigue, stock.
4. `tickProjects()` — phases pre→shoot→post→ready, burn % of budget, overruns.
5. Pre-release marketing: `tickCampaignDrops()`, `tickPromos()`, `tickAdvances()` (all keyed off `p.releaseWeek-G.week`).
6. Org/AI: board, exec careers, espionage, legal, label, game studio, fan mail, crises.
7. **Release gate**: for each ready project with `releaseWeek<=G.week`, pay remaining marketing, `releaseFilm(p)`.
8. Economy cycle, geo events, podcasts, guild strikes, chaos, `tickRivalAI()` (mostly stub, see §5).
9. `tickTheatrical()` (weekly decay + rentals), `tickSeries`, `tickRivals()` (rival slate decay).
10. `tickBuzz()` (word-of-mouth news/buzz), empire, streamer, sports, live, pay-1/Ott offers, facilities, bonds.
11. Filters (`offers` expiry), `refreshIdeas()`, ~18% chance new talent, talent-pool trim to ~52 humans + animals.
12. `tickPoaching`, renegotiation, **`tickFestivals()`** (awards-circuit choice modal), `tickEvents()` (34% chance),
    achievements, endgame, piracy/union/precursors/M&A, btl market rotation (every 13 wks).
13. Year boundary (`woyOf===1`): `yearWrap()` → awards, inflation, new talent class, `seedRivalYear()`.
    **Defect**: `ageTalent()` is called inside `yearWrap()` (engine.js:5783) *and* again at engine.js:6232 when
    `woyOf(G.week)===1` ⇒ talent ages 2 years every year boundary. Fix in the rebuild.
14. Close ledger snapshot into `G.txHistory` (last 12), rep/board history, scenario win check, `saveGame()`.

Design note: every subsystem mutates `G` in place and logs via `log(text, kind)` → `G.news`/`G.flash`. No event bus.

## 2. Film pipeline

```
genIdea() ──> pitchFilm(cfg)/greenlight(cfg) ──> G.projects[]
   idea {id,genre,scale,title,script,hot,born,lapses}      phase:"pre"|"shoot"|"post"|"reshoot"|"ready"
```
- **Ideas**: `genIdea()` (engine.js:1389): random genre, scale weighted by genre, `script=clamp(rint(50,84)+hot*8±,42,94)`,
  lapses after 12 weeks; pool kept at 6-7 (`refreshIdeas`).
- **Pitch vs greenlight**: `pitchFilm()` (2471) is the paid "pitch" route (success roll `0.15+score/200+rep/500`,
  tentpoles need `boardVote`); `greenlight(cfg)` (2575) is the deterministic desk route. Both build the same project object.
- **Project fields that matter**: `phase, phaseWeek, phaseLen{pre,shoot,post}`, `budget/budget0/overrun/spent/devCost`,
  `script, writerBonus, rating, location, pattern, rollout, window, imax, premium, dayAndDate`, `buzzBonus, awareness,
  campaignLegs, promoOwed/promoDone`, `releaseWeek, marketing, marketingPaid`, `cast[], director, writer, producer, cameo`,
  `franchiseName, sequelOf, theme, coProd, alloc{vfx,stunts,cast,music,design}`.
- **Phase lengths** from `DATA.SCALES`: indie pre 2-4/shoot 4-6/post 4-7; mid 3-5/6-9/7-11; tentpole 4-6/9-13/12-18.
- **Weekly burn** (tickProjects): pre 10% of budget / pre weeks; shoot 70% / shoot weeks (×0.88 backlot, ×0.95 stage2,
  ×0.9 virtual, × `econM("prod")`); post 20% (×0.75 VFX). Overrun roll: `risk=clamp(0.15-(prodSkill-45)/300,0.03,0.20)`,
  per event `budget += 0.008–0.025 * budget` (producer halves it).
- **At post end**: `computeQuality(p)` → `phase:"ready"`. Reshoots (`beginReshoot`) cost 12% budget, add `rint(4,9)` quality.
- **Release**: `releaseFilm()` (2873) — computes `opening`, builds the immutable `G.films[]` record, pays `opening*0.53`
  rentals immediately, runs `reviewFilm()`, opens theatrical run. Film record adds `weekly[{w,gross}]`, `dom, intl, ww,
  legs, decay, weeksOut, inTheaters, rentalsDom, campaignLegs, reviews, criticAvg, freshPct`.
- **End of run**: `endTheatrical()` (4027) — final intl gross from genre `intlShare`, PVOD `ww*0.055`, talent backend,
  profit = `studioRev + presales - budget - marketing - devCost - locCost`; verdict vs `breakevenWW`; rep ±.

## 3. Box office math (the load-bearing formulas)

**Opening weekend** — `expectedOpening(p, weekAbs)` (engine.js:2296):
```
base   = SCALES[scale].openBase * GENRES[genre].mass * (genre.openBoost||1) * G.infl
starF  = 1 + 0.075*min(Σ cast.power (NA), 6)         // scandal ×0.82..0.94
mktF   = clamp((max(marketing,1)/recMarketing(p))^0.45, 0.5, 1.55)
         // marketing above 45 is log-compressed: 45 + log10(1+m-45)*16
recMarketing(p) = budget * SCALES[scale].mktRate * (G.infl) * econM("adcost")
season = seasonOfW(week).season        // Jan .80 … Jul 1.20, Nov 1.28, Dec 1.32
fr     = franchise ? frHeatMult*1.35 : 1   // frHeatMult = 0.82+0.36*decay
hype   = base*starF*mktF*season*fr*(1-fatigue)*trendPull*repF*comp*(1+buzzBonus)*(1+awareness)
         * ratingMult * pat.open * roll.open * timelineFactor * uniMult
         * chainScreenMult * exhibMult        // repF = 0.92+rep/600
opening = clamp(hype * (0.85+rnd()*0.34), 1.2, 320)
```
`repPerk`/`specBonus` add small multipliers; `trendPull = 1+(trend-1)*0.75`; `competitionFactor` uses weight share
`(w_self/Σw)^0.55 × crowd(1.08/1.0/0.9)` clamped 0.15-1.08.

**Weekly decay / legs** — `legsOf(film)` (2393) then `tickTheatrical()` (3017):
```
legs  = 1.6 + (quality.overall-30)*0.028 + GENRES[g].legsAdj
        + holiday 0.12 + aud>=85 +0.08 / aud<=40 -0.10
        + pat.legs + roll.legs + campaignLegs + imax 0.05 + abilities.legs
legs  = clamp(legs, 1.45, 4.4)
decay = 1 - 1/legs
weekN_gross = opening * decay^weeksOut          // geometric decay
  × holiday 1.18 × piracy(1 - meter/100*0.10) × econBoxOfficeMult
run ends when gross < max(0.3, opening*0.006) or weeksOut>16
studio rentals = gross * 0.53 * splitMult
intl = dom/(1-genre.intlShare) - dom   (intl rentals 42% at end of run)
```
**Reviews & word of mouth**: quality is computed once (`computeQuality`, 1506):
`craft = 0.30*script + 0.24*dirScore + 0.22*castSkill + 0.24*prodScore` + ability/fit/fatigue/test mods + `gauss()*5.5`;
then `critic = overall + genre.critic + gauss()*3`, `aud = overall + genre.aud + min(Σpower,8)*1.2 + gauss()*3`.
`reviewFilm()` draws 5 named critics (harsh ±, loves/hates), `criticAvg`, `freshPct`, then blends
`quality.critic = critic*0.45 + criticAvg*0.55`. `tickBuzz()` reacts to live films: opening≥60, aud≥80 memes (+2% buzz),
scandal (−2%), quality≥85 acclaim — all feed `buzzBonus`, which multiplies next week's gross via `legs`/opening only
indirectly (buzz is applied at release; weekly gross uses fixed decay) — **buzz affects legs only through
`campaignLegs` and release-time opening**.
**Marketing**: channels (`campaignDefs`) with `{cost, hype, aware, legs, drop[]}`; staggered drops roll
viral(18%→×1.5)/whiff(15%→×0.5), demo fit ×1.5. `recMarketing` is the "expected" P&A benchmark.

## 4. Data shapes worth reusing (data.js)

- **Genres** (15): `{name, mass, legsAdj, intlShare, china, critic, aud, otta, awards, budgetBias, merch, openBoost?}`.
  Examples: action `mass 1.25, legsAdj -0.10, intlShare 0.63`; animation `mass 1.20, legsAdj +0.45, merch 1.50`;
  horror `mass 0.92, legsAdj -0.35, openBoost 1.45, budgetBias 0.60`.
- **Scales** (3): `indie {bMin 4,bMax 25, openBase 9, mktRate .55, pre/shoot/post weeks}`; `mid {28-90, openBase 30, .60}`;
  `tentpole {110-280, openBase 100, .85}`.
- **Talent** (~46 at start: 22 actors, 9 directors, 8 writers, 7 producers + 3 hot + 8 animals):
  `{id, kind, name, power 1-5, skill 20-97, fee, genreFit, age, heat 0-3, scandal, bookedUntil, powerByRegion{NA,EU,AS,LA,AF},
  ability, contract, multiDeal, chem{}, pics, joinedYear}`.
  Fees: `STAR_FEE.actor=[0.3,1.2,4,12,25]`, director `[0.8,2,5,10,18]`; `actorFee` = fee × (1+0.25·heat) × scandal 0.55 ×
  contract mult × agency/wage multipliers.
- **Rivals** (3 defs): `{name, style:"tentpole"|"prestige"|"balanced", slate[], ytd}`.
- **Other reusable tables**: 8 OTT platforms `{generosity, renew, taste{genre:mult}}`; 5 theater chains
  `{screens share, taste, rel}`; 4 festivals `{woy, loves[], prestige, market}`; 6 locations `{rebate, cap, audit, treaty}`;
  8 named critics `{harsh, loves[], hates[]}`; ~38 abilities `{craft{}, open, legs, intl, award, overrun}`; 14 themes
  (`loves/hates` genre affinity: love +5 craft/+8% opening, clash −4); 15 marketing channel defs; 4 economic cycles
  `{boxOffice, loanRate, streamChurn}`; 8 territories `{share, risk, piracy, genre{}}`.

## 5. Rival studio AI

- **Real behavior** is `seedRivalYear()` + `tickRivals()` (engine.js:4539-4631): each rival pre-books 6-15 release slots
  per year biased to style corridors (tentpole weeks 18-28/45-51; prestige 36-50/1-6), genre by style, `weight =
  openBase*mass*infl*trendPull`, quality `rint(40,90)`. On release week `opening = weight*(0.8+rnd()*0.45)*season*trend
  *econ`, then head-to-head share vs your same-week openings; weekly decay reuses the same legs formula with genre
  `legsAdj`. `r.ytd` accumulates.
- **`tickRivalAI()` (3603) is effectively a stub**: it initialises personalities/memory and decays memory, but the
  greenlight/poach/acquire branches are empty comments. The decision helpers (`rivalDecisionGreenlight/Poach/Acquire`,
  3568-3602) exist but are not wired into the tick. Personality data (5 archetypes) and memory weights are dead weight
  in the current build — port the *shape*, not the code.
- Actual aggression against the player: `tickPoaching()` (7091, ~2.2%/wk base, casting head blocks 60%),
  `tickEspionage()` (awareness leaks, mole scripts), `playChicken()` (rivals move off your weekend if `weight < your*1.15`,
  55% chance), `rivalAcquire()` (player buys distressed rivals at `catalogValue*2`).

## 6. Port vs drop (focused mobile rebuild)

**Port (high value, low baggage)**
- `expectedOpening` + `legsOf` + `decay^weeksOut` core — the whole game is legible from these ~40 lines.
- `DATA.GENRES` / `DATA.SCALES` tuning tables + `seasonOf` calendar — already compact and balance-tested.
- Project phase machine (`pre/shoot/post/ready`, `phaseLen`, weekly burn, overruns) — simple, readable.
- Named-critic review panel and `computeQuality` weighted craft score — cheap and gives the game its voice.
- Rival slate generation (`seedRivalYear`/`tickRivals`) — ~90 lines, no UI dependencies.
- Marketing drops with viral/whiff rolls — good mobile "collection" moment.
- Talent generator + `STAR_FEE`/`actorFee` modifiers + hidden abilities (trim ability list to ~12).

**Drop or defer**
- The ~30 optional feature modules (streamer, sports, live TV, podcasts, M&A, NFTs, theme parks, universe graph,
  prototype RPG, game-dev studio) — `advanceWeek` already guards them; a rebuild should simply not ship them.
- `tickRivalAI` personality/memory scaffolding — currently dead code.
- 9-version save migration chain (`SAVE_MIGRATIONS` v2-v9) — replace with a fresh schema.
- Dual pitch routes (`pitchFilm` vs `greenlight`) — keep one.
- Territory/city/chain-level splits (calcTerritoryGross, regionSplit, cityRows) — nice dashboards, not core loop.
- `whatIf` deep-clone sandbox, CSV ledger export, IndexedDB backup layers — platform plumbing, redo natively.

**Fix while porting**
- Double `ageTalent()` on year boundary (5783 + 6232) — ages talent twice per year.
- `computeQuality` reads `G`/`techDone`/`hqOwned` directly (not pure); make it a pure function of project + studio mods.
- `expectedOpening`'s 20+ multiplicative modifiers make balance opaque; collapse to 6-8 named factors.
- Buzz after release has little mechanical effect (only `campaignLegs`); decide whether word-of-mouth should bend
  weekly decay — currently it doesn't.
