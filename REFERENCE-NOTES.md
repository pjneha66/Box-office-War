# 📚 Reference Study — v28 Design Notes

**Source:** the user-supplied reference folder (`~/Downloads/refrence`) contains four mobile tycoon games:
**Game Dev Story**, **TV Studio Story**, **Social Dev Story** (Kairosoft pixel sims) and **Box Office Sim 2**
(a Capacitor/Ionic movie-studio sim).

**Method:** we analyzed these titles for *mechanics and systems design only*. No code, art, audio,
or text from the reference APKs was copied into this project — every system below is an original
implementation built to fit Box Office War's existing engine. Game ideas aren't owned; execution is,
and ours is written from scratch.

---

## What each reference taught us

### Box Office Sim 2 (closest genre match)
| Their system | What it does (as observed) | Our original take → v28 feature |
|---|---|---|
| Talent model | 8 skills per person + per-region star power (5 regions) + morale/energy | We kept our simpler power/skill model but added **hidden rarity-tiered abilities** (see below) |
| Abilities | Assignable per-talent traits in rarity tiers, filterable in a codex | **Talent Abilities** — 20+ passive traits across 4 rarities, data-driven effects, revealed via auditions |
| Targets page | A watchlist of bookmarked talent for later poaching | **⭐ Watchlist** pin on any talent + a hub panel |
| Long-term contracts | Per-person deals that expire on movies fulfilled *or* weeks elapsed, whichever first | We already had 3-film deals; added a **📜 Active Deals** overview panel (films left / expiry) |
| Festivals | Entry modes: competition (region-filming eligibility), auction (film sold to highest bidder), release locked until runs finish | **Festival entry modes** — world premiere / competition (shoot-location eligibility) / market auction |
| Franchise transfer | Sell your franchise to rival bids; buy rival-held IP | **IP transfer market** — sell offers on your franchises + rival franchise listings in the IP market |
| Custom studio/person/franchise | Sandbox content creation | Deferred — our name/title generators already cover the need; revisit if requested |

### Kairosoft sims (Game Dev Story · TV Studio Story · Social Dev Story)
| Their signature system | What it does (as widely documented) | Our original take → v28 feature |
|---|---|---|
| Genre × Theme combos | Pair a genre with a theme; hidden "great match!" affinities are discovered by shipping and remembered | **Themes & Combo Discovery** — 14 themes, hidden affinities, ⭐/✖ revealed permanently after you ship a pairing |
| Staff leveling/training | Train staff stat-by-stat, level up on the job | Already covered by our 🎓 Star School + skill trees |
| Fans counter | Studio fanbase gates better hires and sales | Already covered by our subscriber/rep/fan-mail stack |
| Boost points during dev | Spend earned points mid-production | Already covered by our budget-allocation + BTL crew systems |

---

## v28 features shipped (all original code)

1. **🎭 Talent Abilities** — every actor/director/writer/producer can carry one hidden ability
   (common → legendary). Effects are pure data: craft nudges, opening-multiplier, legs, intl share,
   overrun risk, awards odds. Hidden until you **audition** the candidate (3% of fee) or finish
   one film with them. Negative "tabloid magnet" trait adds risk spice.
2. **🎨 Themes & Combo Discovery** — greenlight wizard now has a theme step. Affinities are
   hidden; shipping a pairing reveals it permanently ("Great match! Sci-Fi × Time Loop").
   Loves: +5 quality, +8% opening. Clashes: −4 quality.
3. **🎪 Festival Entry Modes** — per festival: *World Premiere* (as before), *Competition*
   (film must have shot in the festival's home region; bigger buzz/awards payoff, eligibility
   enforced), *Market Auction* (finished film auctioned to rival studios for cash — they get
   the picture, you get the money and a rep bump).
4. **🌍 IP Transfer Market** — your franchise modal shows rival buy-out offers (sell = cash +
   rival strength, small rep hit); rival-owned franchises occasionally appear for sale in the
   IP market (buy = instant dormant franchise, purchased buzz bonus on the next entry).
5. **⭐ Watchlist + 📜 Active Deals** — pin talent from their profile; talent hub shows your
   watchlist and every active multi-film deal with films remaining.

## Balance notes
- Abilities are tuned to be felt, not to dominate: a legendary is worth roughly +1★ of opening
  pull spread across effects; audition cost scales with fee so screening a roster has real cost.
- Auction offers land at 45–70% of projected box office — selling trades upside for certainty.
- Franchise sale prices ≈ 60–85% of franchise WW track record; selling kills merch/park income
  attached to it, so it's a cash-crunch tool, not a money printer.
