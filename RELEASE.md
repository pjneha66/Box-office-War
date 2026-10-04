# Launch Readiness — Box Office War v27

Status snapshot for the full Shippable Product Plan (Phases 1–6). Everything below ships in this build.

## What's in (by phase)

### Phase 1–2 — Full RPG Character System
- 9-grid alignment: 3 work styles (Lawful/Neutral/Chaotic) × 3 morals (Good/Neutral/Ruthless) with production + personal effects
- 3 skill branches × 4 talent types (12 trees, 44 nodes), prerequisites, aggregated production bonuses
- 4 equipment slots (Weapon/Armor/Accessory/Prop), 5 rarities, effective-attribute computation
- Relationship web (bonds from collaborations, life events; friends/rivals at ±5 strength)
- Mentorship (3+ level gap, weekly XP transfer, milestone on formation)
- Expanded life events: 6 event families incl. social/mentorship/feud with relationship effects
- Guilds per craft with weekly dues + professional-development skill points

### Phase 3 — Game Dev Expansion
- GDD modal: 7 genres × 5 platforms × 5 themes × 5 mechanics × 6 business models, with synergy scoring and budget preview
- 8 dev phases (pre → prototype → vertical slice → alpha → beta → content complete → gold → launch) with per-phase choices and cost weights
- Team composition (up to 5 roster talents, their RPG stats drive quality)
- Weekly sales tails per monetization model (premium/DLC/F2P+IAP/sub/ads/freemium)
- Live ops: weekly event rolls (patches, content drops, expansions, film crossovers) that refresh sales
- Annual Game of the Year award

### Phase 4 — Economy
- 4 currencies: cash, reputation, fame/infamy (per talent), influence (studio-level)
- Influence sinks: masterclass intensives (+1000 XP), hype surge (+10% next opening)
- Influence sources: awards, smash hits, acclaimed launches, GOTY

### Phase 5 — Production Readiness
- Accessibility: aria labels on icon buttons/dialogs, `aria-current` on tabs, focus trap + Escape in modals, reduced-motion support (existing), landmarks (`<main>`)
- i18n: en/hi chrome strings incl. new sections; dynamic game copy stays English by design
- Privacy/GDPR: first-boot consent, Privacy & Data modal with full JSON export and delete-everything wipe; no network calls, no accounts
- Tutorial: extended with RPG-sheet and in-house-games steps
- Balance harness: `npm run balance` — 6 seeds × 120 weeks, ~1,300 assertions (cash finite, XP flow, level bounds, event rate caps, game pipeline reachable, rep band)
- Security: SSRF-guarded fetch (literal URL, key in header), static-require test bundles (no vm/eval)

### Phase 6 — Launch Polish
- Guilds, game awards, achievements (+8 new: level 10, 3 games, mentorship, 4 slots, 4 genres, 50 influence, 3 guild members, 3 live-ops)
- Streamer churn prediction (weekly warning + OTT dashboard risk badge)
- Mod support: `window.BOW_MODS = { data:{...}, onBoot:[fn] }` hook merged at boot
- This checklist

## Known scope cuts (honest list)
- Full WCAG audit / screen-reader pass NOT done — targeted a11y only
- Hindi covers chrome only; long-form news/events remain English
- COPPA: no age gate (no data collection exists at all); add one before any store submission targeting kids
- Mod support is a data/boot hook, not a content pipeline or workshop integration
- Balance harness validates sanity bands, not competitive meta

## Pre-launch checklist
- [x] `npm test` green (smoke + 60+ UI steps + balance harness)
- [x] Repeated-run stability (3× clean)
- [x] Deployed to production (Vercel)
- [x] Save migration from v13 schema (prototype fields ride the whole-G snapshot)
- [ ] Store listing assets (screenshots, icons — PWA PNG icons still pending from mobile audit)
- [ ] 30-min human playtest vs. Go/No-Go criteria in `.opencode/plans/prototype_plan.md`
