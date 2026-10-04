# RPG CHARACTER SYSTEM & GAME DEV EXPANSION - MASTER PLAN

**Project**: Box Office War - RPG Character System & Game Development Expansion  
**Status**: MASTER PLAN (Prototype + Shippable Product)  
**Date**: 2024  
**Version**: 2.0  

---

## 🎯 EXECUTIVE SUMMARY

This master plan covers **two phases**:

| Phase | Target | Timeline | Purpose |
|-------|--------|----------|---------|
| **Phase 0: Prototype** | Validate core fantasy | 2-3 weeks | Prove core loop is fun |
| **Phase 1-6: Shippable Product** | Complete shippable product | 16-20 weeks | Commercial release ready |

**Core Fantasy**: "I'm a studio head managing Hollywood talent as RPG characters with progression, equipment, and meaningful choices — and I can also make games."

---

## 📋 CURRENT STATE ANALYSIS

### Existing Talent System (from data.js)
- **Talent Types**: actor, director, writer, producer
- **Attributes**: power (1-5), skill (40-99), fee, genreFit, age, scandal, heat
- **Relationships**: chemistry, feuds, muse directors, multi-picture deals
- **Progression**: training, star school, aging, retirement
- **Contracts**: multi-picture, exclusive, backend, bonus, franchise
- **Below-the-line**: DP, composer, VFX house

### Existing Game Development (v16)
- **Game Division**: unlockable at rep ≥ 40, cash ≥ $250M
- **Developer Houses**: in-house, partner, elite AAA
- **Platforms**: mobile, PC, console
- **Game Projects**: dev phases, quality scores, sales tracking
- **Porting**: multi-platform support

---

## 🎮 PHASE 0: PROTOTYPE (2-3 Weeks)

### Core Fantasy to Validate
> "I'm a studio head managing Hollywood talent as RPG characters with progression, equipment, and meaningful choices — and I can also make games."

### Prototype Scope (IN vs OUT)

| IN (Prototype) | OUT (Deferred) |
|----------------|----------------|
| Character Sheets: 1 tab, 5 attrs, level/XP, 1 skill branch | Full 9-grid alignment |
| Alignment: 3-axis (Lawful/Neutral/Chaotic) | Full 9-grid |
| Equipment: 2 slots (Weapon, Armor), 5 rarities | 4 slots, accessories, consumables |
| Life Events: 3 types, 1/week per talent | Relationship web, mentorship |
| Game Dev Unlock: 1 project, 3 phases, ship 1 | LiveOps, seasons, battle pass |
| Character Sheet UI: Stats/Equip/Events tabs | Relationship visualization |

### Prototype Technical Decisions
| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Data** | Extend `G.talent` in-place + `G.prototypeData` | No migration, backward compatible |
| **Engine** | Extend existing `engine.js` patterns | No refactor |
| **UI** | Vanilla JS + existing modal pattern | No build step |
| **Storage** | `localStorage` only | Prototype data disposable |
| **Files** | 4 new files max (~1500 lines) | Minimal surface area |

### Prototype Success Criteria (Go/No-Go)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Character sheet opens | <200ms | Console timing |
| Level 5 in 15 min play | Level 5 @ 15min | Playtest observation |
| Legendary equipment impact | +20% quality | A/B test |
| Ship 1 game in session | Launch reached | Playtest completion |

### Prototype Go/No-Go Decision Matrix

| Outcome | Action |
|---------|--------|
| All Must-Hit + 2+ Nice-to-Hit | Greenlight full 16-week plan |
| Most Must-Hit, core loop fun | Greenlight 8-week "Phase 1 Lite" |
| Core loop broken/not fun | Pivot: different RPG metaphor |
| Technical debt too high | Refactor data layer, retry |

---

## 🎮 PHASE 1-6: SHIPPABLE PRODUCT (16-20 Weeks)

### Phase 1: RPG Character System (Weeks 1-4)

#### 1.1 Character Sheet Expansion (Full)
- **9-Grid Alignment**: Lawful/Neutral/Chaotic × Good/Neutral/Evil
- **5 Attributes**: Charisma, Intellect, Creativity, Discipline, Luck (1-100)
- **Level/XP**: Curve `XP = 1000 × level^1.5`
- **Backstory, Personal Goal, Secret** fields
- **Traits & Quirks** system

#### 1.2 Full Skill Trees (3 Branches × 4 Types)
| Talent | Branch 1 | Branch 2 | Branch 3 |
|--------|----------|----------|----------|
| Actor | Star Power | Craft Mastery | Industry Navigation |
| Director | Visual Storytelling | Production Command | Industry Navigation |
| Writer | Craft Mastery | Genre Specialization | Industry Navigation |
| Producer | Dealmaking | Production Command | Talent Development |

#### 1.5 Full Equipment/Inventory
- **4 Slots**: Weapon, Armor, Accessory 1, Accessory 2
- **5 Rarities**: Common → Uncommon → Rare → Epic → Legendary
- **Inventory**: Consumables (Script Doctor, PR Crisis Manager)

### Phase 2: Character Progression & Events (Weeks 5-6)

#### 2.1 Dynamic Life Events (Expanded)
| Category | Frequency | Examples |
|----------|-----------|----------|
| Career Opportunity | Weekly | "Offered lead in tentpole" |
| Personal Crisis | Monthly | "Divorce", "Health scare" |
| Industry Event | Weekly | "Oscar campaign", "Comic-Con" |
| Relationship | Bi-weekly | "New romance", "Feud" |
| Scandal Risk | Monthly | "Leaked photos", "Legal trouble" |

#### 2.2 Full Relationship Web (-100 to +100)
- Rivalry → Friend → Soulmate with mechanical effects
- Mentorship system with legacy items

### Phase 3: Game Development Expansion (Weeks 7-10)

#### 3.1 Full GDD System
- **Concept, Genre, Core Loop, USP, Scope, Monetization**
- **Tech Requirements**: Engine, Platforms, Multiplayer

#### 3.1.2 Full Development Phases
| Phase | Duration | Key Decisions |
|-------|----------|---------------|
| Pre-production | 4-8 weeks | Concept, GDD, prototype |
| Vertical Slice | 4-6 weeks | Core mechanics, art style |
| Production | 12-52 weeks | Content creation |
| Alpha | 4-8 weeks | Feature complete |
| Beta | 4-8 weeks | Content complete, polish |
| Gold/Cert | 2-4 weeks | Certification |
| Launch | 1 week | Marketing sync |
| Live Ops | Ongoing | Seasons, patches |

#### 3.1.3 Full Team Composition
```javascript
team: {
  leads: { creativeDirector, technicalDirector, artDirector, designLead },
  disciplines: { programming, art, design, audio, qa, production },
  headcount, burnRate, velocity
}
```

#### 3.2 All Game Genres & Platforms
| Genre | Core Loop | Budget | Timeline |
|-------|-----------|--------|----------|
| RPG | Explore→Fight→Loot→Upgrade | $10M-$200M+ | 2-5 years |
| Action | Move→Shoot→Dodge→Progress | $20M-$300M | 2-4 years |
| Strategy | Plan→Execute→Adapt | $5M-$50M | 2-3 years |
| Simulation | Build→Manage→Optimize | $5M-$30M | 2-3 years |
| Puzzle | Observe→Think→Solve→Progress | $1M-$10M | 1-2 years |
| Roguelike | Run→Die→Learn→Progress | $2M-$20M | 1-2 years |
| MMO | Social→Progress→Raid→Economy | $50M-$500M+ | 4-7 years |

#### 3.3 Full Platform Strategy (5 platforms)
#### 3.4 Full LiveOps & Seasons (12-week seasons, battle pass, events)

### Phase 4: Economy & Monetization (Weeks 11-12)

#### 4.1 Full Currency Architecture (4 Currencies)
| Currency | Type | Purpose | Sources | Sinks |
|----------|------|---------|---------|-------|
| Studio Cash | Soft | Operations | Film/game revenue | Production, salaries |
| Prestige | Hard | Prestige unlocks | Awards, milestones | Legendary talent, upgrades |
| Reputation | Soft | Industry access | Successful releases | Scandals, flops |
| Creative Control | Hard | Greenlight power | Successful originals | Studio interference |

#### 4.2 All Monetization Models
- Premium ($60), F2P+Cosmetics, Season Pass, Battle Pass, DLC, Subscription

### Phase 5: Production Readiness (Weeks 13-16)

#### P0: Blockers for Commercial Release
- Accessibility Framework (WCAG 2.1 AA) - **L effort, Critical**
- Localization Pipeline (i18n) - **L effort, Critical**
- GDPR/COPPA/Privacy Compliance - **M effort, Critical**
- Save/Load Optimization + Cloud Sync - **M effort, High**
- Onboarding/Tutorial System - **M effort, Critical**
- Automated Balance Testing Framework - **L effort, Critical**
- Security Threat Model + Audit - **M effort, Critical**

#### P1: Core Gameplay Completeness
- Film→Game Adaptation Pipeline - **M effort, Critical**
- Marketing Campaign Builder - **L effort, Critical**
- Review Score Aggregator (Metacritic sim) - **M effort, Critical**
- Reputation/Faction System (Unions, Studios, Critics) - **S effort, High**
- Studio Lot/Housing System - **M effort, High**
- DLC/Expansion Planning Pipeline - **M effort, High**
- Crunch/Burnout Mechanics - **S effort, Critical**
- Meaningful Choice/Consequence System - **L effort, High**

### Phase 6: Polish & Ship (Weeks 17-20)

#### P2: Deepening & Retention
- Guild/Union System (SAG/DGA/WGA) - **M effort, High**
- Achievements/Titles/Collections - **S effort, High**
- Seasonal Festivals/World Events - **M effort, High**
- Player Segmentation + Churn Prediction - **L effort, High**
- Content Calendar Tooling - **M effort, High**
- Transmedia Universe Bible - **L effort, High**
- Mod Support Architecture - **XL effort, High**
- A/B Testing + Feature Flags - **M effort, High**

#### Launch Readiness (Weeks 19-20)
- Launch Checklist (cert, store assets, press kit, support docs)
- Post-Launch Runbook (incident response, rollback, hotfix)
- Analytics Event Taxonomy, Error Budget/SLOs
- Security Threat Model + Audit
- Accessibility Audit Plan (WCAG 2.1 AA)

---

## 🛡️ ERROR LOGGING & CATCH SYSTEM (Both Phases)

### Error Capture
- Global handlers: `window.error`, `unhandledrejection`
- Console interception: `console.error`, `console.warn` capture
- Game state snapshots: week, studio state, active tab, counts
- IndexedDB persistence with session tracking
- Debug panel: Ctrl+Shift+E opens error review UI
- Server reporting (optional, `keepalive` fetch)
- Console buffer: last 100 errors

### Error Categories & Auto-Report
| Category | Severity | Auto-Report |
|----------|----------|-------------|
| `javascript_error` | Critical | ✅ |
| `unhandled_promise_rejection` | High | ✅ |
| `save_error` | Critical | ✅ |
| `network_error` | High | Optional |

---

## 📦 DELIVERABLES

| Deliverable | Prototype | Shippable |
|-------------|-----------|-----------|
| Prototype Branch | ✅ | - |
| Playtest Notes | ✅ | - |
| Balance Spreadsheets | Prototype | ✅ Full |
| Wireframes | ASCII | High-Fi Mockups |
| GDD Document | Outline | ✅ Full |
| Tuning Spreadsheets | Prototype | ✅ Full |
| Implementation Specs | Prototype | ✅ Full |
| Test Plan | Basic | ✅ Full |
| Unit/Integration Tests | - | ✅ Full |
| Balance Test Cases | - | ✅ Automated |
| Performance Budgets | - | ✅ Defined |
| Security Threat Model | - | ✅ Documented |
| Accessibility Audit Plan | - | ✅ WCAG 2.1 AA |
| Localization Kit | - | ✅ Full i18n |
| Launch Checklist | - | ✅ Complete |
| Post-Launch Runbook | - | ✅ Complete |

---

## 🗓️ UNIFIED TIMELINE

```
Week 1-3:     PROTOTYPE (validate core fantasy)
    └─ Go/No-Go Decision Point
Week 4-7:     PHASE 1: Character Foundation
Week 8-9:     PHASE 2: Progression & Events
Week 10-13:   PHASE 3: Game Dev Expansion
Week 14-15:   PHASE 4: Economy & Monetization
Week 16-19:   PHASE 5: Production Readiness
Week 20:      PHASE 6: Polish & Launch
```

---

## 🔄 PHASE GATES & GO/NO-GO CRITERIA

| Gate | Criteria | Decision |
|------|----------|----------|
| **Prototype → Phase 1** | All Must-Hit + 2+ Nice-to-Hit | Greenlight full plan |
| **Phase 3 → Phase 4** | Core loop fun, game dev works | Continue |
| **Phase 5 → Phase 6** | All P0 complete, balance stable | Polish & ship |
| **Launch** | All P0+P1 done, stability >99% | Ship |

---

## 📊 RESOURCE ESTIMATES

| Phase | Engineers | Weeks | Total Effort |
|-------|-----------|-------|--------------|
| Prototype | 1-2 | 3 | 3-6 eng-weeks |
| Phase 1-4 (Core) | 2-3 | 12 | 24-36 eng-weeks |
| Phase 5 (Production Ready) | 3 | 4 | 12 eng-weeks |
| Phase 6 (Launch) | 3 | 2 | 6 eng-weeks |
| **Total** | | **19-22 weeks** | **45-60 eng-weeks** |

---

## ❓ CLARIFYING DECISIONS NEEDED

1. **Scope Priority**: Character RPG depth first, or game dev expansion first?
2. **Complexity Target**: Mobile-friendly simplicity or desktop-depth?
3. **Integration**: RPG stats → film/game production directly? (charisma → marketing boost)
4. **Multiplayer**: Social/PvP element (duels, auditions, collaborations)?
5. **Persistence**: Character history across save slots/new games?
6. **Art Assets**: Character portraits, equipment icons, skill icons?
7. **Localization**: i18n from start?

---

## 📦 FINAL DELIVERABLES

| Deliverable | Prototype | Shippable |
|-------------|-----------|-----------|
| Prototype Branch | ✅ | - |
| Playtest Notes | ✅ | - |
| Balance Spreadsheets | Prototype | ✅ Full |
| Wireframes | ASCII | High-Fi Mockups |
| GDD Document | Outline | ✅ Full |
| Tuning Spreadsheets | Prototype | ✅ Full |
| Implementation Specs | Prototype | ✅ Full |
| Test Plan | Basic | ✅ Full |

---

**Total Timeline**: 19-22 weeks (Prototype + Shippable)  
**Total Effort**: 45-60 engineer-weeks  
**Team Size**: 2-3 engineers recommended  

---

**Ready for review. Please indicate:**
1. Proceed with prototype first, then full build?
2. Adjust scope/complexity targets?
3. Any specific technical decisions to lock in?