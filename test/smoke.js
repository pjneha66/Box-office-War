// Box Office War — Smoke Tests
// Run: node test/smoke.js

import { Engine } from '../engine.js';

const engine = new Engine();
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    console.log(`✅ ${name}`);
  } else {
    failed++;
    console.log(`❌ ${name}`);
  }
}

// Test 1: Engine initializes
assert(engine !== null, 'Engine initializes');

// Test 2: Has required methods
assert(typeof engine.tick === 'function', 'Has tick method');
assert(typeof engine.startGame === 'function', 'Has startGame method');
assert(typeof engine.upgradeStudio === 'function', 'Has upgradeStudio method');

// Test 3: State exists
assert(engine.state !== undefined, 'State exists');
assert(engine.state.studio !== undefined, 'Studio state exists');

// Test 4: Studios array exists
assert(Array.isArray(engine.studios), 'Studios array exists');

// Test 5: Rivals array exists
assert(Array.isArray(engine.rivals), 'Rivals array exists');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
