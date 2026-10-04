# RPG CHARACTER SYSTEM - PROTOTYPE / MVP PLAN

**Project**: Box Office War - RPG Character Prototype  
**Target**: 2-3 weeks (vs 16-20 weeks full)  
**Status**: PROTOTYPE PLANNING  
**Date**: 2024

---

## 🎯 PROTOTYPE SCOPE: MINIMUM VIABLE FANTASY

### Core Fantasy to Validate
> "I'm a studio head managing Hollywood talent as RPG characters with progression, equipment, and meaningful choices — and I can also make games."

### What's IN (Must-Have for Prototype)

| Feature | Scope | Why It Validates |
|---------|-------|------------------|
| **Character Sheets** | 1 tab, 5 attributes, level/XP, 1 skill tree branch | Core RPG feel |
| **Alignment** | 3-axis (Lawful/Neutral/Chaotic only) | Quick personality impact |
| **Equipment** | 2 slots (Weapon, Armor), 5 rarities, 3 items each | Loot dopamine |
| **Life Events** | 3 event types, 1 per week per talent | Narrative emergence |
| **Game Dev Unlock** | 1 project type, 3 phases, ship 1 game | Second pillar works |
| **Character Sheet UI** | Single modal, tabbed (Stats/Equip/Events) | Player touchpoint |

### What's OUT (Deferred to v2)

| Feature | Deferred Because |
|---------|------------------|
| Full 9-grid alignment | 3-axis captures 80% of value |
| All 3 skill tree branches per type | 1 branch proves progression |
| Accessory slots, consumables | Core 2 slots enough for prototype |
| Relationship web, mentorship | Too much UI for 2 weeks |
| Full GDD system | "Pick genre → ship game" is enough |
| Team composition, burn rate | Single dev house proves concept |
| LiveOps, seasons, battle pass | Requires launched game first |
| Multi-currency economy | Studio cash only for prototype |
| Roguelike, MMO, Strategy genres | 1 genre (RPG) validates pipeline |
| Cross-platform, certification | Ship to PC only |
| Full save migration | Prototype data can reset |
| Relationship visualization | Text list sufficient |
| Character portraits, art | Placeholder icons work |

---

## 📦 PROTOTYPE SCOPE DEFINITION

### 2-Week Build Target (Aggressive)
```
Week 1: Data + Engine + Core UI
Week 2: Game Dev + Polish + Playtest
```

### 3-Week Build Target (Realistic)
```
Week 1: Character System Foundation
  - Extended talent schema (alignment, 5 attrs, level/XP, equipment slots)
  - Alignment modifiers (3-axis only)
  - Level/XP curve + gain sources
  - Equipment data (Weapon/Armor, 5 rarities, 3 items each)
  - Character sheet modal (Stats tab only)

Week 2: Progression + Events + Game Dev
  - 1 skill tree branch per talent type (Actor: Star Power)
  - Life event engine (3 types, weekly roll)
  - Game Dev unlock (rep≥40, cash≥$250M)
  - Single game project: RPG, 3 phases (Pre/Prod/Launch)
  - Character sheet: add Equipment + Events tabs

Week 3: Integration + Balance + Build
  - Cross-system: talent stats → film quality → game quality
  - Balance pass: XP curve, event frequency, equipment power
  - Save/load with new fields
  - 30-min playtest session
  - Build + deploy prototype
```

---

## ⚙️ TECHNICAL STACK DECISIONS FOR RAPID PROTOTYPING

### Use Existing Stack (Zero New Dependencies)
| Layer | Decision | Rationale |
|-------|----------|-----------|
| **Data** | Extend `G.talent[]` in-place, add `G.prototypeData` namespace | No migration, backward compatible |
| **Engine** | New functions in existing `engine.js` pattern | Same architecture, no refactor |
| **UI** | Vanilla JS + CSS (existing modal pattern) | No build step, instant iteration |
| **State** | `localStorage` only (no IndexedDB) | Prototype data is disposable |
| **Events** | Simple array push + weekly tick | No event bus needed |

### New Files Only (Minimal Surface Area)
```
/js/
  prototype/
    characterSheet.js    // Character sheet logic (500 lines max)
    lifeEvents.js        // Event generation (300 lines)
    gameDevLite.js       // Single game project (400 lines)
    prototypeUI.js       // Modal + tabs (300 lines)
```

### Data Structures (Minimal)

```javascript
// Extended talent (add to existing G.talent objects)
talent.prototype = {
  alignment: "lawful" | "neutral" | "chaotic",  // 3-axis only
  attributes: { cha: 50, int: 50, cre: 50, dis: 50, luk: 50 },
  level: 1, xp: 0, xpToNext: 1000, skillPoints: 0,
  equipment: { weapon: null, armor: null },
  events: [],  // Last 10 life events
  skillTree: { branch: "starPower", nodes: [] }  // 1 branch only
};

// Equipment (static data in prototype/data.js)
PROTOTYPE_EQUIPMENT = {
  weapon: [
    { id: "script_good", name: "Solid Script", rarity: "common", quality: +5 },
    { id: "script_oscar", name: "Oscar Bait Script", rarity: "rare", quality: +15 },
    { id: "script_franchise", name: "Franchise IP", rarity: "legendary", quality: +30 }
  ],
  armor: [
    { id: "pr_basic", name: "Junior Publicist", rarity: "common", scandalReduction: 10 },
    { id: "pr_crisis", name: "Crisis Manager", rarity: "rare", scandalReduction: 25 },
    { id: "pr_legendary", name: "Fixer Elite", rarity: "legendary", scandalReduction: 50 }
  ]
};

// Life Events (3 types only)
PROTOTYPE_EVENTS = [
  { type: "career", weight: 50, templates: ["Offered lead in {genre} film", "Director {name} wants you"] },
  { type: "personal", weight: 20, templates: ["Health scare", "Relationship stress"] },
  { type: "scandal", weight: 30, templates: ["Leaked photo", "Controversial quote"] }
];

// Game Dev Lite
gameDevLite = {
  unlocked: false,
  project: null,  // Single active project
  // { genre: "rpg", phase: "pre|prod|launch", progress: 0-100, quality: 0-100, team: [talentIds] }
};
```

---

## ✅ PROTOTYPE SUCCESS CRITERIA

### Must-Hit (Go/No-Go for v2 Investment)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| **Character sheet opens in <200ms** | <200ms | Console timing |
| **Player reaches Level 5 in 15 min play** | Level 5 @ 15min | Playtest observation |
| **Equipment feels impactful** | +20% quality with legendary | A/B: equipped vs not |
| **Life events feel meaningful** | Player recalls 2+ events post-session | Post-play survey |
| **Game dev unlock feels earned** | Unlock at ~week 20-30 sim time | Log unlock week |
| **Ship 1 game in prototype session** | Launch screen reached | Playtest completion |

### Nice-to-Hit (Quality Signals)

| Criterion | Target |
|-----------|--------|
| Player equips items without tutorial | >60% |
| Player allocates skill points | >50% |
| Player reads event text (not skip) | >40% |
| "One more turn" feeling at 30 min | Subjective |

### Fail Criteria (Stop Prototype)
- Character sheet >500ms to open
- No visible progression in 10 min
- Game dev unlock never triggers in 30 min sim
- Critical bugs blocking core loop

---

## 🛡️ RISK MITIGATION FOR PROTOTYPE PHASE

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Scope creep** | High | High | Hard freeze: any "nice to have" = automatic v2. Weekly scope review. |
| **Existing save corruption** | Medium | High | Prototype uses separate `G.prototypeData` namespace. No migration. |
| **UI performance on large talent rosters** | Medium | Medium | Virtualize list, lazy-load sheets, cap at 50 talents for prototype. |
| **XP curve feels broken** | High | Medium | Expose curve constants in debug panel (Ctrl+Shift+P) for live tuning. |
| **Event spam fatigue** | Medium | Medium | Hard cap: 1 event/talent/week. Cooldown 3 weeks per event type. |
| **Game dev too simple = boring** | Medium | High | Add 3 meaningful choices per phase (scope/quality/speed tradeoff). |
| **Prototype becomes "the product"** | High | High | Time-box: auto-delete prototype branch after 3 weeks. Tag `prototype-v1`. |
| **Data model wrong for v2** | Low | High | Document every assumption. v2 redesign is expected. |

---

## 📋 PROTOTYPE IMPLEMENTATION CHECKLIST

### Week 1: Foundation
- [ ] Add prototype fields to `G.talent` objects (alignment, attrs, level, xp, equipment, events)
- [ ] Create `PROTOTYPE_EQUIPMENT` static data
- [ ] Implement `gainXP(talentId, amount, source)` with 3 sources (film, award, training)
- [ ] Implement `levelUp(talentId)` → +1 skill point, attribute choice
- [ ] Build Character Sheet modal (Stats tab: portrait, name, alignment, 5 attr bars, level/XP bar)
- [ ] Add "Character Sheet" button to talent roster

### Week 2: Systems
- [ ] Skill Tree: 1 branch per type (Actor: Star Power, Director: Visual Storytelling, Writer: Craft, Producer: Dealmaking)
- [ ] 5 nodes per branch, 1-3 SP cost, simple +stat effects
- [ ] Life Event Engine: weekly roll per talent, 3 event types, apply effects immediately
- [ ] Equipment: drag-drop or click-to-equip, show stat preview
- [ ] Game Dev Lite: unlock check, create project (genre=rpg), 3 phases with 1 choice each
- [ ] Character Sheet: Equipment tab, Events tab (last 10)

### Week 3: Integration
- [ ] Cross-link: talent attributes → film quality bonus (cha→marketing, int→script, dis→schedule)
- [ ] Cross-link: talent attributes → game quality bonus
- [ ] Balance: XP curve, event weights, equipment power
- [ ] Save/Load: serialize prototype fields
- [ ] Debug panel: XP curve tuner, event log viewer, force-level, force-event
- [ ] 30-min internal playtest + notes
- [ ] Build + tag `prototype-v1`

---

## 🎮 PROTOTYPE PLAYTEST SCRIPT (30 min)

1. **Start new game** → hire 3 talents
2. **Open character sheet** → note load time
3. **Equip "Solid Script"** → make film → note quality diff
4. **Train talent** → gain XP → level up → pick skill node
5. **Wait for life event** (simulate week) → read → react
6. **Reach rep 40 / $250M** → unlock Game Dev
7. **Start RPG project** → make 3 phase choices → launch
8. **Post-play**: "What was fun? What was confusing? What's missing?"

---

## 📦 DELIVERABLES

1. **Prototype branch** (`prototype/rpg-character-v1`) - auto-deletes after 3 weeks
2. **Playtest notes** - 1 page per session
3. **Balance spreadsheet** - XP curve, equipment stats, event weights
4. **Go/No-Go decision doc** - based on success criteria

---

## 🔄 POST-PROTOTYPE DECISION MATRIX

| Outcome | Action |
|---------|--------|
| **All Must-Hit + 2+ Nice-to-Hit** | Greenlight full 16-week plan (Phase 1 priority) |
| **Most Must-Hit, core loop fun** | Greenlight 8-week "Phase 1 Lite" (character system only) |
| **Core loop broken / not fun** | Pivot: different RPG metaphor (deckbuilder? card game?) |
| **Technical debt too high** | Refactor data layer first, then retry 2-week prototype |

---

**Approval**: _______________ **Date**: _______________  
**Prototype Lead**: _______________ **Review Date**: _______________
