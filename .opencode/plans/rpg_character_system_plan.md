# RPG CHARACTER SYSTEM & GAME DEVELOPMENT - IMPLEMENTATION PLAN

**Project**: Box Office War - RPG Character System & Game Development Expansion  
**Status**: PLANNING PHASE (Read-Only)  
**Date**: 2024  
**Version**: 1.0

---

## 🎯 EXECUTIVE SUMMARY

This plan outlines the implementation of a comprehensive **RPG Character System** and **Game Development Expansion** for Box Office War, leveraging the existing talent system and adding deep RPG mechanics, character progression, equipment systems, and game development simulation features.

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

## 🎮 PHASE 1: RPG CHARACTER SYSTEM (Core RPG Mechanics)

### 1.1 Character Sheet Expansion
**New Fields for All Talent Types**:
```javascript
// Extended Character Sheet
{
  // Identity
  alignment: "lawful_good" | "neutral" | "chaotic_evil" | etc.,  // 9 alignments
  backstory: "string",           // 2-3 sentence narrative
  personalGoal: "string",        // e.g., "Win an Oscar", "Direct a tentpole"
  secret: "string",              // Hidden trait revealed through events
  
  // RPG Stats (1-100 scale)
  attributes: {
    charisma: 50,    // Audience appeal, negotiation
    intellect: 50,   // Script quality, direction skill
    creativity: 50,  // Originality, improvisation
    discipline: 50,  // Reliability, schedule adherence
    luck: 50         // Random event modifiers
  },
  
  // Progression
  level: 1,
  xp: 0,
  xpToNextLevel: 1000,
  skillPoints: 0,           // For talent tree allocation
  
  // Equipment System
  equipment: {
    weapon: null,        // Metaphorical: "Oscar-worthy script", "A-list agent"
    armor: null,         // "PR team", "Legal counsel"
    accessory1: null,    // "Lucky charm", "Mentor's advice"
    accessory2: null     // "Personal trainer", "Dialect coach"
  },
  inventory: [],          // Consumables: "Script doctor", "PR crisis manager"
  
  // Relationships
  relationships: {
    rivals: [],           // Talent IDs with rivalry score
    allies: [],           // Talent IDs with alliance score
    mentors: [],          // Talent IDs who mentor this talent
    students: []          // Talent IDs this talent mentors
  },
  
  // Reputation & Fame
  fame: 0,                // 0-100, public recognition
  infamy: 0,              // 0-100, negative reputation
  industryRespect: 0,     // 0-100, peer respect
  
  // Traits & Quirks
  traits: [],             // "Perfectionist", "Method actor", "Improviser"
  quirks: [],             // "Always late", "Demands blue M&Ms"
  
  // Career Milestones
  milestones: [
    { type: "first_credit", week: 12, project: "Film Title" },
    { type: "first_award", week: 45, award: "Best Actor" },
    { type: "breakthrough", week: 78, project: "Tentpole" }
  ]
}
```

### 1.2 Alignment System (9-Grid)
| Lawful Good | Neutral Good | Chaotic Good |
|-------------|--------------|--------------|
| Lawful Neutral | True Neutral | Chaotic Neutral |
| Lawful Evil | Neutral Evil | Chaotic Evil |

**Mechanical Effects**:
- **Lawful**: +10% contract compliance, -10% creative freedom
- **Chaotic**: +15% creative output, -15% schedule adherence
- **Good**: +10% audience appeal, -5% villain roles
- **Evil**: +15% villain role fit, -10% family audience

### 1.3 Level/XP System
**XP Sources**:
| Action | Base XP | Modifiers |
|--------|---------|-----------|
| Film release | 500 | × quality score / 50 |
| Award win | 2000 | × award prestige |
| Award nomination | 500 | |
| Skill training complete | 1000 | × skill gain |
| Milestone achieved | 2000 | × milestone tier |
| Scandal survived | 1000 | - scandal severity |

**Level Curve**: `XP = 1000 × level^1.5`

### 1.4 Skill Trees (Per Talent Type)
**Actor Tree**:
```
Branch: Star Power
├── Charisma Boost (5 SP) → +10 charisma
├── Audience Draw (10 SP) → +15% opening weekend
└── Franchise Anchor (20 SP) → +25% sequel negotiation

Branch: Craft Mastery
├── Method Acting (5 SP) → +10 discipline, +5 intellect
├── Accent Mastery (10 SP) → +15% international appeal
└── Physical Transformation (20 SP) → +20% body horror/action fit

Branch: Industry Navigation
├── Agent Negotiator (5 SP) → -10% agent fees
├── Producer Ally (10 SP) → +15% greenlight chance
└── Studio Insider (20 SP) → Access to studio slate
```

**Director Tree**:
```
Branch: Visual Storytelling
├── Visual Style (5 SP) → +10 creativity
├── Auteur Signature (10 SP) → +15% critic score
└── Genre Mastery (20 SP) → +25% genre-specific quality

Branch: Production Command
├── Schedule Master (5 SP) → -10% overrun chance
├── Budget Wizard (10 SP) → -15% budget overrun
└── Studio Whisperer (20 SP) → Board approval auto-pass
```

### 1.5 Equipment/Inventory System
**Equipment Slots**:
| Slot | Category | Examples | Effects |
|------|----------|----------|---------|
| Weapon | Career Tool | "Oscar Script", "A-list Agent", "Franchise IP" | +Quality, +Opening |
| Armor | Protection | "PR Team", "Legal Counsel", "Crisis Manager" | -Scandal impact, -Scandal chance |
| Accessory 1 | Enhancement | "Lucky Charm", "Mentor's Advice" | +Luck, +XP gain |
| Accessory 2 | Support | "Personal Trainer", "Dialect Coach" | +Physical/Accent roles |

**Rarity Tiers**: Common → Uncommon → Rare → Epic → Legendary
- **Legendary**: "Meryl's Blessing", "Spielberg's Mentorship", "Marvel Contract"

---

## 🎲 PHASE 2: CHARACTER PROGRESSION & EVENTS

### 2.1 Dynamic Life Events
**Event Categories**:
| Category | Frequency | Examples |
|----------|-----------|----------|
| Career Opportunity | Weekly | "Offered lead in tentpole", "Director wants you for passion project" |
| Personal Crisis | Monthly | "Divorce", "Substance abuse", "Health scare" |
| Industry Event | Weekly | "Oscar campaign", "Film festival", "Comic-Con panel" |
| Relationship | Bi-weekly | "New romance", "Feud with co-star", "Mentor retirement" |
| Scandal Risk | Monthly | "Leaked photos", "Controversial quote", "Legal trouble" |

### 2.2 Relationship Web
**Relationship Types**:
| Type | Range | Effects |
|------|-------|---------|
| Rivalry | -100 to -1 | -Quality when paired, +Scandal chance |
| Neutral | 0 | No effect |
| Acquaintance | 1-25 | +5% chemistry |
| Friend | 26-50 | +10% chemistry, +5% greenlight |
| Close Friend | 51-75 | +20% chemistry, +10% greenlight, -Scandal |
| Soulmate/Blood Brother | 76-100 | +30% chemistry, auto-greenlight, immunity to feud |

### 2.3 Mentorship System
- **Mentor Benefits**: +20% XP gain, access to mentor's network, trait inheritance
- **Student Benefits**: Mentor gains +10% industry respect per successful student
- **Legacy**: Retired mentors leave "Legacy Items" (equipment) to students

---

## 🏭 PHASE 3: GAME DEVELOPMENT EXPANSION

### 3.1 Enhanced Game Development Simulation
**Current State**: Basic dev houses, platforms, quality scores
**Expanded Systems**:

#### 3.1.1 Game Design Document (GDD) System
```javascript
gameDesignDoc: {
  concept: "string",           // Elevator pitch
  genre: "rpg" | "action" | etc.,
  coreLoop: "string",          // "Explore → Fight → Loot → Upgrade"
  targetAudience: "core" | "casual" | "hardcore",
  usp: "string",               // Unique selling proposition
  scope: "indie" | "aa" | "aaa",
  estimatedHours: 20,
  monetization: "premium" | "f2p" | "season_pass",
  techRequirements: {
    engine: "unreal" | "unity" | "custom",
    platforms: ["pc", "console", "mobile"],
    multiplayer: boolean
  }
}
```

#### 3.1.2 Development Phases (Expanded)
| Phase | Duration | Key Decisions | Risk Factors |
|-------|----------|---------------|--------------|
| Pre-production | 4-8 weeks | Concept, GDD, prototype | Scope creep, unclear vision |
| Vertical Slice | 4-6 weeks | Core mechanics, art style | Technical debt |
| Production | 12-52 weeks | Content creation | Scope creep, crunch |
| Alpha | 4-8 weeks | Feature complete | Bugs, optimization |
| Beta | 4-8 weeks | Content complete, polish | Balance, compatibility |
| Gold/Cert | 2-4 weeks | Certification | Platform rejection |
| Launch | 1 week | Marketing sync | Server issues, bugs |
| Live Ops | Ongoing | Seasons, patches | Player retention |

#### 3.1.3 Team Composition
```javascript
team: {
  leads: {
    creativeDirector: talentId,
    technicalDirector: talentId,
    artDirector: talentId,
    designLead: talentId
  },
  disciplines: {
    programming: [talentIds],      // Engineers
    art: [talentIds],              // Artists, animators
    design: [talentIds],           // Level, systems, narrative
    audio: [talentIds],            // Composers, sound designers
    qa: [talentIds],               // Testers
    production: [talentIds]        // Producers, PMs
  },
  headcount: 0,
  burnRate: 0,        // Weekly cost
  velocity: 0         // Features/week
}
```

### 3.2 Game Genres & Archetypes
| Genre | Core Loop | Key Metrics | Typical Budget | Timeline |
|-------|-----------|-------------|----------------|----------|
| RPG | Explore→Fight→Loot→Upgrade | Retention, ARPU | $10M-$200M+ | 2-5 years |
| Action | Move→Shoot→Dodge→Progress | Session length, completion | $20M-$300M | 2-4 years |
| Strategy | Plan→Execute→Adapt | Session depth, retention | $5M-$50M | 2-3 years |
| Simulation | Build→Manage→Optimize | Session length, creativity | $5M-$30M | 2-3 years |
| Puzzle | Observe→Think→Solve→Progress | Completion, frustration | $1M-$10M | 1-2 years |
| Roguelike | Run→Die→Learn→Progress | Runs/session, unlocks | $2M-$20M | 1-2 years |
| MMO | Social→Progress→Raid→Economy | DAU, LTV, churn | $50M-$500M+ | 4-7 years |

### 3.3 Platform Strategy
| Platform | Audience | Revenue Split | Certification | Update Cadence |
|----------|----------|---------------|---------------|----------------|
| PC (Steam) | Core, modders | 70/30 | Light | Weekly |
| Console (PS/Xbox) | Core, casual | 70/30 | Strict | Monthly |
| Mobile (iOS/Android) | Casual, mass | 70/30 | Medium | Bi-weekly |
| Nintendo | Family, portable | 70/30 | Strict | Monthly |
| Cloud (GeForce/Stadia) | Emerging | 70/30 | Medium | Weekly |

### 3.4 Live Operations & Seasons
```
Season Structure (12 weeks):
├── Pre-season (2 weeks): Teasers, battle pass preview
├── Launch Week: Major content drop, balance patch
├── Mid-season (5 weeks): Mini-event, balance tweaks
├── Mid-season Patch: Major balance, new content
├── Late Season (4 weeks): Ranked rewards, finale event
└── Off-season (1 week): Wrap up, next season teaser
```

---

## 💰 PHASE 4: ECONOMY & MONETIZATION DESIGN

### 4.1 Currency Architecture
| Currency | Type | Purpose | Sources | Sinks |
|----------|------|---------|---------|-------|
| Studio Cash | Soft | Operations | Film revenue, game revenue | Production, salaries, marketing |
| Prestige | Hard | Prestige unlocks | Awards, milestones, milestones | Legendary talent, studio upgrades |
| Reputation | Soft | Industry access | Successful releases, relationships | Scandals, flops |
| Creative Control | Hard | Greenlight power | Successful originals | Studio interference, flops |

### 4.2 Game Monetization Models
| Model | Player Type | Revenue Curve | Risk |
|-------|-------------|---------------|------|
| Premium ($60) | Core | Launch spike, long tail | High upfront risk |
| F2P + Cosmetics | Mass | Steady, growing | Pay-to-win perception |
| Season Pass | Engaged | Recurring, predictable | Content treadmill |
| Battle Pass | Competitive | Recurring, engagement-driven | FOMO burnout |
| DLC/Expansion | Invested | Spike per release | Fragmentation |
| Subscription | Loyal | Predictable, recurring | Churn risk |

---

## 📅 IMPLEMENTATION ROADMAP

### Sprint 1 (Week 1-2): Character Foundation
- [ ] Extend talent schema with RPG fields
- [ ] Implement alignment system
- [ ] Add level/XP framework
- [ ] Create character sheet UI component

### Sprint 2 (Week 3-4): Progression & Equipment
- [ ] Skill tree implementation
- [ ] Equipment/inventory system
- [ ] Level-up mechanics
- [ ] Character sheet modal

### Sprint 3 (Week 5-6): Life Events & Relationships
- [ ] Dynamic event system
- [ ] Relationship web visualization
- [ ] Mentorship mechanics
- [ ] Scandal/reputation system

### Sprint 4 (Week 7-8): Game Dev Expansion
- [ ] GDD system
- [ ] Expanded dev phases
- [ ] Team composition UI
- [ ] Platform strategy

### Sprint 5 (Week 9-10): LiveOps & Economy
- [ ] Season system
- [ ] Currency architecture
- [ ] Monetization models
- [ ] LiveOps calendar

### Sprint 6 (Week 11-12): Polish & Integration
- [ ] Cross-system integration
- [ ] Tutorial/onboarding
- [ ] Balance testing
- [ ] Documentation

---

## 📊 SUCCESS METRICS

| Metric | Target |
|--------|--------|
| Character sheet completion rate | >80% of players |
| Average talent level at week 52 | ≥Level 10 |
| Skill tree engagement | >60% allocate points |
| Equipment usage rate | >50% slots filled |
| Game dev unlock rate | >30% by week 52 |
| Game release rate | ≥2 games/studio/year |
| LiveOps retention (12-week) | >40% |
| Economy stability (90 days) | No inflation >10% |

---

## 🔧 TECHNICAL CONSIDERATIONS

### Data Structure Changes
- Extend `G.talent[]` objects with new fields (backward compatible)
- Add `G.characterSheets` map for extended data
- Extend `G.gamesDiv` with liveOps, seasons, team management
- Add `G.characterEvents` log for narrative continuity

### Performance
- Memoize character sheet calculations
- Virtualize relationship web rendering
- Lazy-load character sheets on demand
- Debounce auto-save during editing

### Save Migration
- Add `v26` migration for new character fields
- Default values for all new fields
- Preserve existing talent data

---

## 🎨 UI/UX SPECIFICATIONS

### Character Sheet Modal
```
┌─────────────────────────────────────────────────────┐
│ [Portrait]  NAME                    Level 15 ★★★★  │
│ Alignment: Chaotic Good    Fame: 72  Infamy: 12    │
├─────────────────────────────────────────────────────┤
│ ATTRIBUTES          │ SKILL TREE          │ EQUIP  │
│ Charisma    85 ████ │ █ Star Power    ███ │ 🗡 Wep │
│ Intellect   72 ████ │ █ Charisma +10  ●○○ │ 🛡 Arm │
│ Creativity  78 ████ │ █ Audience Draw ●○○ │ 💍 Acc1│
│ Discipline  65 ████ │ █ Franchise Anc ●○○ │ 💍 Acc2│
│ Luck        55 ████ │                   │        │
├─────────────────────────────────────────────────────┤
│ RELATIONSHIPS          │ MILESTONES                     │
│ 🎭 Tom Cruise (Friend) │ 🏆 Week 12: First Credit       │
│ 🎬 Nolan (Mentor)      │ 🏆 Week 45: Oscar Nomination   │
│ ⚔️ Rival: DiCaprio     │ 🏆 Week 78: Tentpole Lead      │
└─────────────────────────────────────────────────────┘
```

### Game Dev Dashboard
```
┌─────────────────────────────────────────────────────┐
│ GAME STUDIO: "Interactive Division"        [📊 GDD] │
├─────────────────────────────────────────────────────┤
│ IN DEVELOPMENT (2/3 slots)                          │
│ ████████░░ 65%  "Dragon's Fall" (RPG)    [AAA]     │
│   Phase: Beta | Team: 120 | Burn: $2.4M/wk         │
│   Launch: Week 14 | Platforms: PC, PS5, XB        │
│                                                     │
│ ████░░░░░░ 30%  "Mobile Mayhem" (Puzzle) [F2P]    │
│   Phase: Production | Team: 25 | Burn: $0.3M/wk   │
│                                                     │
│ RELEASED (3 games)                                  │
│ 🏆 "Space Trader"  87/100  $45M revenue  [Mobile]  │
│ 🏆 "Dungeon Delver" 82/100 $12M revenue  [PC]      │
│ 📉 "Clicky Clicker" 45/100 $0.2M revenue [Mobile]  │
├─────────────────────────────────────────────────────┤
│ LIVE OPS: Season 3 "Dragon Rising"  Week 4/12      │
│ Battle Pass: 34% completion | Revenue: $2.1M/wk    │
└─────────────────────────────────────────────────────┘
```

---

## 🛡️ ERROR LOGGING & CATCH SYSTEM

### 5.1 Client-Side Error Capture
```javascript
// Global error handler (add to index.html or main entry point)
window.addEventListener('error', (event) => {
  logError({
    type: 'javascript_error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    gameState: captureGameStateSnapshot()
  });
});

// Promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  logError({
    type: 'unhandled_promise_rejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
    timestamp: Date.now(),
    gameState: captureGameStateSnapshot()
  });
});
```

### 5.2 Game State Snapshot Capture
```javascript
function captureGameStateSnapshot() {
  if (!window.G) return null;
  return {
    week: G.week,
    studio: {
      name: G.studio.name,
      cash: G.studio.cash,
      rep: G.studio.rep,
      debt: G.studio.debt
    },
    activeTab: window.TAB,
    activeModal: document.querySelector('.modal') ? 'open' : 'none',
    talentCount: G.talent?.length || 0,
    filmCount: G.films?.length || 0,
    projectCount: G.projects?.length || 0,
    gamesDiv: window.G.gamesDiv ? {
      unlocked: window.G.gamesDiv.unlocked,
      projectCount: window.G.gamesDiv.projects?.length || 0
    } : null,
    consoleErrors: window.__consoleErrors || []
  };
}
```

### 5.3 Error Logging Service
```javascript
// Error log storage (IndexedDB for persistence)
const ERROR_DB_NAME = 'BoxOfficeWarErrors';
const ERROR_STORE = 'errors';

async function logError(errorData) {
  const errorEntry = {
    id: crypto.randomUUID(),
    ...errorData,
    sessionId: getSessionId(),
    buildVersion: GAME_VERSION || 'dev'
  };

  // Console logging for dev
  console.error('[GameError]', errorEntry);

  // Store in IndexedDB
  try {
    await saveErrorToIDB(errorEntry);
  } catch (e) {
    console.warn('Failed to persist error:', e);
  }

  // Send to server if online (optional)
  if (navigator.onLine && ERROR_REPORTING_ENDPOINT) {
    fetch(ERROR_REPORTING_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorEntry),
      keepalive: true
    }).catch(() => {});
  }
}

function getSessionId() {
  let sid = sessionStorage.getItem('game_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('game_session_id', sid);
  }
  return sid;
}
```

### 5.4 Error Review UI (Admin/Debug Panel)
```javascript
// Debug panel: Press Ctrl+Shift+E to open
function openErrorReviewPanel() {
  const errors = await getAllErrorsFromIDB();
  let html = '<h3>🐛 Error Log (' + errors.length + ')</h3>';
  html += '<div class="card"><table><thead><tr><th>Time</th><th>Type</th><th>Message</th><th>Tab</th><th>Action</th></tr></thead><tbody>';
  errors.slice(-50).reverse().forEach(e => {
    html += `<tr><td>${new Date(e.timestamp).toLocaleTimeString()}</td>
      <td><span class="tag">${e.type}</span></td>
      <td>${escapeHtml(e.message?.slice(0,100))}</td>
      <td>${e.gameState?.activeTab || 'N/A'}</td>
      <td><button class="btn btn-xs" onclick="copyError(${e.id})">Copy</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  openModal(html);
}
```

### 5.5 Console Error Interception
```javascript
// Capture console.error/warn for error log
const originalError = console.error;
const originalWarn = console.warn;
window.__consoleErrors = [];

console.error = (...args) => {
  window.__consoleErrors.push({ type: 'error', args, time: Date.now() });
  if (window.__consoleErrors.length > 100) window.__consoleErrors.shift();
  originalError.apply(console, args);
};

console.warn = (...args) => {
  window.__consoleErrors.push({ type: 'warn', args, time: Date.now() });
  if (window.__consoleErrors.length > 100) window.__consoleErrors.shift();
  originalWarn.apply(console, args);
};
```

### 5.6 Error Categories & Severity
| Category | Severity | Examples | Auto-Report |
|----------|----------|----------|-------------|
| `javascript_error` | Critical | Uncaught TypeError, ReferenceError | Yes |
| `unhandled_promise_rejection` | High | Failed fetch, DB error | Yes |
| `game_logic_error` | Medium | Invalid state, NaN calculations | Optional |
| `render_error` | Medium | Canvas/WebGL errors | Optional |
| `save_error` | Critical | localStorage/IndexedDB failure | Yes |
| `network_error` | High | Failed API calls | Optional |
| `validation_error` | Low | Schema validation failures | No |

### 5.7 Implementation Checklist Additions
```markdown
### Error Logging System
- [ ] Global error handlers (window.error, unhandledrejection)
- [ ] Console.error/warn interception
- [ ] Game state snapshot capture
- [ ] IndexedDB error persistence (IndexedDB)
- [ ] Error review debug panel (Ctrl+Shift+E)
- [ ] Server error reporting endpoint (optional)
- [ ] Error categorization & severity tagging
- [ ] Session ID tracking
- [ ] Build version tagging
- [ ] Error deduplication (prevent spam)
- [ ] Error export/download for bug reports
- [ ] Error rate alerting (if >10/min)
```

---

## 📝 IMPLEMENTATION CHECKLIST

### Data Layer
- [ ] Extend `DATA.TALENT` schema with RPG fields
- [ ] Add `DATA.RPG` constants (alignments, skill trees, equipment)
- [ ] Extend `DATA.GAME_DEV` with liveOps, seasons, genres
- [ ] Add `DATA.CHARACTER_EVENTS` for life events
- [ ] Update `DATA.SAVE_VERSION` to 14

### Engine Layer
- [ ] `generateCharacterSheet(talentId)` - builds full sheet
- [ ] `gainXP(talentId, amount, source)` - XP with source tracking
- [ ] `levelUp(talentId)` - level up with skill point allocation
- [ ] `equipItem(talentId, slot, itemId)` - equipment management
- [ ] `triggerLifeEvent(talentId)` - dynamic event generator
- [ ] `processRelationships()` - chemistry/feud calculation
- [ ] `createGameDesignDoc(config)` - GDD generator
- [ ] `startGameDev(config)` - expanded game dev
- [ ] `tickGameDev()` - liveOps, seasons, patches
- [ ] `calculateCharacterPower(talentId)` - composite power score

### UI Layer
- [ ] Character sheet modal with tabs
- [ ] Skill tree visualization (SVG/Canvas)
- [ ] Equipment drag-drop interface
- [ ] Relationship web graph (D3.js or Canvas)
- [ ] Game dev dashboard with liveOps panel
- [ ] GDD editor with validation
- [ ] Season pass / battle pass UI
- [ ] Character progression timeline

---

## ❓ CLARIFYING QUESTIONS

1. **Scope Priority**: Should we prioritize character RPG depth first, or game dev expansion first?
2. **Complexity Target**: Mobile-friendly simplicity or desktop-depth complexity?
3. **Integration**: Should RPG stats affect film/game production directly (e.g., charisma → marketing boost)?
4. **Multiplayer**: Any social/PvP element for characters (duels, auditions, collaborations)?
5. **Persistence**: How much character history persists across save slots/new games?
6. **Art Assets**: Will we need character portraits, equipment icons, skill icons?
7. **Localization**: Text-heavy systems - plan for i18n from start?

---

## 📦 DELIVERABLES

Upon approval, this plan yields:
1. **GDD Document** - Full design doc for all systems
2. **Tuning Spreadsheets** - XP curves, skill costs, equipment stats
3. **Wireframes** - Character sheet, game dev dashboard, skill trees
4. **Implementation Specs** - Data structures, function signatures, migration steps
5. **Test Plan** - Unit tests, integration tests, balance test cases

---

**Ready for review. Please indicate which phases to prioritize or any modifications needed.**