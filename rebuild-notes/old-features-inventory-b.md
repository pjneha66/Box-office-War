# Old-Features Inventory B — Missing Sub-Features vs the Rebuild (`game/`)

Scope: the 16 legacy modules listed in the task, compared against the rebuild's stated feature
set. Ambiguous cases were spot-checked against the rebuilt code (`game/engine.js`,
`game/biz.js`, `game/ui.js`) so items the rebuild already ships are **not** listed as missing.

**Verified present in the rebuild and therefore excluded below:**
- Ratings recut + chain-of-title clearance — `game/engine.js:985-999`
- Rival star-poaching events (retain/lose choice) — `game/engine.js:760-770`, `game/ui.js:568`
- Espionage exposure risk (operatives caught, rep −2) — `game/biz.js:289-292`
- Dynasty heirloom cash bonus on bankruptcy — `game/engine.js:896`
- Localization as a global program (+3% intl) — `game/biz.js:52`

Each bullet names the mechanic, its numeric effect, and the old-file anchor (`file:line`).

---

## 1. clash-analytics.js — rebuild has "clash factor + calendar warnings"
- **Counter-programming windfall** — releasing romance/comedy/horror/drama opposite ≥2 tentpoles grants +16% opening audience share. `clash-analytics.js:64`
- **Per-rival cannibalization scaling** — −12% per same-genre rival in the ±1-week window (−18% when the rival is tentpole-scale); rebuild uses one flat clash factor. `clash-analytics.js:52`
- **Tentpole-threat premium** — +8% cannibalization per blockbuster in the window for non-counter genres. `clash-analytics.js:55`
- **Severity grading** — LOW / MODERATE (>12%) / CRITICAL (>25%) classification of the weekend. `clash-analytics.js:68-73`
- **Holdover competition** — films still in theaters within ±3 weeks of the target week count toward congestion, not just new announcements. `clash-analytics.js:37-40`

## 2. cinematic-universe.js — rebuild has "franchises + one crossover event"
- **Multi-franchise shared universe** — charter a universe for $30M and interconnect extra franchises as branches (subFranchises/frIds). `cinematic-universe.js:49,63`
- **Lore consistency stat** — starts 85; +3 when a film has a credited writer, −8 without (floor 40); it scales the crossover multiplier. `cinematic-universe.js:64, recordUniverseRelease`
- **Universe fatigue** — more than 2 releases per year: fatigue up to 60 pts, box-office decay multiplier down to 0.65×. `cinematic-universe.js:122-125`
- **Scaling crossover multiplier** — +18% per extra franchise × lore factor, capped at 1.65× total (rebuild has a single flat crossover event). `cinematic-universe.js:134`
- **Annual bookkeeping** — per-year entry counts reset each new year and drive the fatigue calculation. `cinematic-universe.js:111-121`

## 3. territory-licensing.js — rebuild has "territory presales (MG now, share later)"
- **Four named regions with market shares** — Europe 35% / APAC 42% / LATAM 14% / MEA 9%; weekly royalties split per region by share. `territory-licensing.js:13-45`
- **Favored-genre fit** — region genre lists swing offers +30% (favored) or −10% (neutral). `territory-licensing.js:calculateTerritoryOffer`
- **Revenue Share deal model** — 20% upfront / 55% backend alternative to MG (rebuild explicitly defers "share later"). `territory-licensing.js:59-64`
- **Per-deal localization toggle** — pay $0.8M at signing for +25% gross in that region only. `territory-licensing.js:68-69, signTerritoryDeal`
- **Rights-window terms** — 13/26/52/104-week terms; royalties stop when the window expires. `territory-licensing.js:signTerritoryDeal, tickWeeklyRoyalties`
- **Offer pricing inputs** — upfront scales with budget, quality and cast star power (0.7–1.3×), not just projected international share. `territory-licensing.js:81-88`

## 4. syndication-tv.js — rebuild has "syndication (advance + 26wk royalties)"
- **Three package tiers** — primetime 52wk / matinee 26wk / cable-cult 12wk with distinct upfront and royalty rates (rebuild: a single 26-week stream). `syndication-tv.js:21-45`
- **Eligibility gates** — packages locked unless WW gross ≥ $80M/$25M/$5M or rating ≥ 70/50/30. `syndication-tv.js:22-23, calculateSyndicationOffer`
- **Rating-scaled upfront bonus** — +6 (primetime) / +2 (others) × rating/100, plus rating feeding the weekly royalty. `syndication-tv.js:75-78`
- **One-deal-per-film exclusivity** — a contracted film cannot be re-syndicated; fulfilled deals are archived. `syndication-tv.js:88-92`

## 5. studio-facilities.js — rebuild has "post wing + backlot (3 levels)"
- **Soundstage complex** — +3 quality/tier (max 5) enabling congestion-free concurrent shooting. `studio-facilities.js:18-26`
- **LED virtual production volume** — +5 quality/tier and −2%/tier location budget. `studio-facilities.js:27-34,146-149`
- **Lease-out mode** — rent any built facility to third parties for 1.5× its weekly maintenance as income; quality boost forfeits while leased. `studio-facilities.js:114-117,170-175`
- **Weekly maintenance drain** — every facility costs 0.6–1% of build value per week (rebuild facilities have no upkeep). `studio-facilities.js:157-166`
- **Genre budget discount** — backlot −4%/tier for sci-fi/fantasy/western/war plus LED −2%/tier, capped −28% (rebuild backlot reduces overruns instead of location fees). `studio-facilities.js:141-150`
- **5-tier cost curve** — upgrades cost baseCost × (tier+1) up to tier 5 (rebuild: 3 levels). `studio-facilities.js:getFacilityCost`

## 6. production-insurance.js — rebuild has "4% premium, overruns halved, flop claim 20%"
- **Tier selection** — 2.5% premium/85% overrun coverage vs 5%/100% full bond; rebuild binds one fixed policy. `production-insurance.js:19-37`
- **Key-star & cast indemnity** — 3.5% premium, 90% coverage of star illness, scandal and emergency-recast costs. `production-insurance.js:27-31`
- **Full completion bond** — 100% of unplanned costs covered; studio exposure capped exactly at greenlight budget. `production-insurance.js:33-37`
- **Per-project binding + claims ledger** — one policy per project, claimsSettled tracked; rebuild's flop claim is a box-office product, not a production guarantor. `production-insurance.js:56-75`

## 7. social-viral-network.js — rebuild has "4 viral tiers with viral/whiff rolls"
- **Box-office legs effects** — campaigns add +8–20% legs on top of buzz (e.g. red-carpet livestream +20%). `social-viral-network.js:72`
- **Review-defense campaign** — bot shield counters review-bombing of a release. `social-viral-network.js:76-80`
- **Cast AMA rep effect** — +8 reputation and softens harsh critic reviews. `social-viral-network.js:63-65`
- **Creator ambassador roster** — 4 creators with genre-matched perks (+25% opening buzz, +20% family legs, +12 critic score defense) on 12-week deals. `social-viral-network.js:86-91, signCreatorDeal`

## 8. industry-expansion-suite.js — rebuild has "ESG/press/localization/label programs"
(recut and rights clearance already exist in `game/engine.js:985-999` — excluded)
- **ESG shoot-burn credits** — installed green programs rebate 2–4.5% of weekly production burn (stack capped 10%) during shooting; rebuild ESG is a static program. `industry-expansion-suite.js:144-158`
- **Film-attached press campaigns** — trade junket (+2.5% awareness/buzz) and critics preview (+3 critic) attach per project; press standing adds up to +2.5% opening. `industry-expansion-suite.js:181-182, openingMultiplier`
- **Per-territory localization packages** — subtitles ×1.08 / full dub ×1.15 / censor recut ×1.11 booked per market (rebuild: one global +3% intl bonus, `game/biz.js:52`); China recut sets a censor-cut flag. `industry-expansion-suite.js:28-31,270`
- **Label genre-matching** — imprint bonuses apply only to matching genres with distinct values (prestige +4 critic; genre label +3.5% opening; family +2.5%/+2). `industry-expansion-suite.js:21-25, applyImprintToFilm`

## 9. theater-chains.js — rebuild has "chains relations + premiere + IMAX unlock"
- **Chain acquisition** — buy 1 of 5 circuits ($70–280M, rep ≥45) owning 960–3,600 national screens. `theater-chains.js:11-17, canBuyChain`
- **Owned-screen split capture** — net theatrical revenue multiplier 1 + ownedShare×0.5 (studio keeps the exhibitor share on its own screens). `theater-chains.js:160`
- **Weekly concession revenue** — owned stands pay every week, scaled by screens, in-theater slate volume and upgrades. `theater-chains.js:tickWeekly`
- **Dolby / VIP / 4DX upgrades** — +8%/+$3, +15%/+$6, +10%/+$5 ticket-yield upgrades per owned chain (rebuild: IMAX only). `theater-chains.js:19-25`

## 10. studio-nextwave-suite.js — rebuild has forecast/mezz/save/heirloom
(star-poaching already exists in the rebuild — excluded)
- **Rival counter-programming AI** — rivals shift their release ±1–2 weeks to dodge your tentpole or heavy-marketing films. `studio-nextwave-suite.js:429-437`
- **Choice incidents** — cyberattack (contain −$7M / disclose −$3M / conceal: −4 rep, +$6M debt), script leak (contain/own/ignore → buzz vs quality risk), crew dispute (settle −$5M / mediate 1-week pause / refuse: strike risk). `studio-nextwave-suite.js:32-60`
- **Franchise revival campaign** — $8M: fatigue −0.14, decay +0.18, back-catalogue heat; lifecycle stages active/resting/legacy with health score. `studio-nextwave-suite.js:277-284, updateFranchiseLifecycle`
- **ESG pledge targets** — file a 25/45/65 carbon target ($3M audit); 52-week audit pays a grant and +2 rep or costs −3 rep. `studio-nextwave-suite.js:288-305`
- **Production scheduling windows** — reserve shoot start weeks; shared cast/crew/location bookings conflict-check across the whole slate. `studio-nextwave-suite.js:224-245`
- **Rival bid/counterbid market** — rivals bid on free-agent talent (3-week expiry); a 1.25× counterbid locks a 26-week exclusive. `studio-nextwave-suite.js:458+`

## 11. studio-espionage.js — rebuild has "3 levels: announce window, script theft, intel"
- **Counter-PR leak op** — $1.25M smear campaign suppresses a rival's opening-weekend buzz by ~22%. `studio-espionage.js:46-51,117-121`
- **Talent-contract intelligence** — $0.65M uncovers expiring contracts with 15–20% poaching discounts. `studio-espionage.js:40-43,108-114`
- **Active mission menu** — choose mission and target per rival with explicit cost/risk (5/10/20% exposure, caught = −4 rep); rebuild runs a passive weekly auto-tick with fixed odds (`game/biz.js:285-309`). `studio-espionage.js:34-51,84-90`

## 12. box-office-sim-2-cast.js — rebuild has "talent abilities 8"
- **121 authentic abilities** in the database vs 8 in the rebuild. `box-office-sim-2-cast.js:7`
- **72 animal-actor species** with power/habitat ratings — animal stars as hireable cast. `box-office-sim-2-cast.js:7,21`
- **Name generation pools** — 380 male + 541 female + 1269 surnames (plus animal names) for procedural talent variety. `box-office-sim-2-cast.js:15-20`

## 13. finance-tools.js — rebuild has "12-week forecast; mezzanine debt; save export/import"
- **Franchise DCF valuation** — 5-year FCF at 10% WACC, Gordon terminal value, WACC×growth sensitivity grid. `finance-tools.js:13,76-140`
- **Comparable studio analysis** — 5 rival comps; median EV/Rev, EV/EBITDA, P/E imply a valuation with premium/discount verdict. `finance-tools.js:180-248`
- **LBO screen for IP acquisitions** — 4× leverage, 70/30 debt/equity, 50% cash sweep, MOIC/IRR with Attractive/Marginal/Pass verdict. `finance-tools.js:250-300`
- **Key-ratio dashboard** — debt/EBITDA, interest coverage, ROIC/ROE, margins, franchise yield. `finance-tools.js:302-345`
- **Currency display** — 7 currencies incl. INR crores and JPY oku formatting. `finance-tools.js:554-575`
- **Save-slot repair tool** — truncated-JSON healing, NaN sanitation, mezzanine-ledger reconciliation. `finance-tools.js:599-650`

## 14. dynasty-legacy.js — rebuild has "heirloom on bankruptcy" only
- **Voluntary NG+ succession** — gate: 52 weeks + 3 films (or $150M cash); rebuild heirloom triggers only on bankruptcy. `dynasty-legacy.js:46-53`
- **Four heir backgrounds** — auteur (+12 critic baseline, −20% director cost), Wall Street heir (+25% fund, −30% interest, +$60M credit), Hollywood royalty (+20 rep, pitches never rejected), digital native (free streamer +$150M, +20% viral reach). `dynasty-legacy.js:11-28`
- **Valuation-scaled inheritance** — trust fund = 12% of studio valuation ($30–180M); rep halo = 35% of parent rep (cap 48). `dynasty-legacy.js:62-64`
- **Heirloom IP carryover** — pick up to 2 top films; they restart as active franchises in the heir's studio (rebuild heirloom = cash only). `dynasty-legacy.js:127-133`
- **Generation tracking** — gen counter, dynasty naming, Hall-of-Fame handoff. `dynasty-legacy.js:83-140`

## 15. talent-contracts.js — rebuild has "abilities 8 + pic deals 3/5 + XP + heat + agency"
(3/5-picture deals exist in the rebuild; the mechanics below are not in its description)
- **Trait-driven production effects** — Fast Shooter: −2 shoot weeks and prevents budget overruns; Improv Master: +6 script quality during the shoot. `talent-contracts.js:26-31,47-51`
- **Trait-driven market effects** — Cult Icon: +35% streaming/syndication value; Method Actor: +15% award-nomination odds but demands a reshoot budget; Crowd Puller: +20% opening buzz; Award Magnet: +8 critic. `talent-contracts.js:19-23,33-43,54-58`
- **Pact economics** — 20% multi-picture rate discount locked per film; signing bonus = 0.8× (3-pic) or 1.2× (5-pic) of the discounted rate. `talent-contracts.js:106-107,123`
- **Consumption ledger** — pictures-remaining tracking, fulfillment archive, retired talent blocked from new pacts. `talent-contracts.js:139-160`

## 16. demographics-audiences.js — no demographic coverage in the rebuild list
- **Four-quadrant audience model** — Kids 22% / Teens 28% / Young adults 32% / Mature 18%, each with favored genres/themes and per-quadrant legs decay (0.78–0.90). `demographics-audiences.js:25-60`
- **Rating gating** — an R rating zeroes the kids quadrant; G/PG adds +15. `demographics-audiences.js:95-98`
- **Dial-test screening** — $0.35M research fee; 6-point minute-by-minute appeal curve flags third-act sag. `demographics-audiences.js:109-140`
- **Pre-release score prediction** — Tomatometer/Popcornmeter computed from quadrant appeal + quality/buzz; certified-fresh at ≥75. `demographics-audiences.js:145-146`
- **Script doctor** — $1.5M one-shot +10 quality rescue before release. `demographics-audiences.js:171-198`
