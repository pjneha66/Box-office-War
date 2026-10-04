#!/usr/bin/env node
/**
 * test/validate-slots.js
 * Standalone Node script that validates bow_slotN records and outputs corrupt fields.
 * Tests integrity of save slot records, validates schema version, and tests repair mechanisms.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// In-memory localStorage mock for headless node execution
const storage = {};
global.localStorage = {
  getItem: (k) => (storage.hasOwnProperty(k) ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// Load data.js and engine.js into the global environment
const dataCode = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
const engineCode = fs.readFileSync(path.join(ROOT, "engine.js"), "utf8");

// Execute scripts in global scope
const vm = require("vm");
vm.runInThisContext(dataCode);
vm.runInThisContext(engineCode);

console.log("=========================================");
console.log("   BOX OFFICE WAR - SAVE SLOT VALIDATOR  ");
console.log("=========================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error("❌ FAIL: " + message);
    process.exit(1);
  }
  passedTests++;
  console.log("✅ PASS: " + message);
}

// 1. Validate slot scanner on empty slots
console.log("\n--- Checking Empty Slots ---");
for (let i = 1; i <= 3; i++) {
  const raw = localStorage.getItem("bow_slot" + i);
  if (!raw) {
    console.log(`ℹ️  Slot ${i}: [Empty] - Ready for new game.`);
  }
}

// 2. Create a clean game and save to slot 1
console.log("\n--- Creating Healthy Save in Slot 1 ---");
newGame("indie", "Starlight Pictures");
G.slot = 1;
saveGame();
const slot1Raw = localStorage.getItem("bow_slot1");
assert(slot1Raw !== null, "Slot 1 was successfully written to localStorage");

const slot1Parsed = JSON.parse(slot1Raw);
const problems1 = validateSave(slot1Parsed);
assert(problems1.length === 0, "Slot 1 has 0 validation problems");
assert(slot1Parsed.v === DATA.SAVE_VERSION, `Slot 1 version matches DATA.SAVE_VERSION (${DATA.SAVE_VERSION})`);
console.log(`ℹ️  Slot 1 Studio: "${slot1Parsed.studio.name}" | Week: ${slot1Parsed.week} | Cash: $${slot1Parsed.studio.cash}M`);

// 3. Test slot corruption detection
console.log("\n--- Testing Corrupt Field Detection in Slot 2 ---");
const corruptSlot = {
  v: 8,
  week: -5, // corrupt week
  studio: {
    name: "Broken Lot",
    cash: "infinite", // corrupt cash type
    rep: NaN          // corrupt rep
  },
  projects: "not an array", // corrupt type
  films: []
  // missing required arrays: series, offers, ideas, franchises, talent, rivals, news
};
localStorage.setItem("bow_slot2", JSON.stringify(corruptSlot));

const slot2Raw = localStorage.getItem("bow_slot2");
const slot2Parsed = JSON.parse(slot2Raw);
const problems2 = validateSave(slot2Parsed);
console.log(`ℹ️  Slot 2 Corrupt Fields Flagged (${problems2.length}):`);
problems2.forEach(p => console.log("   • " + p));

assert(problems2.length >= 5, "Validator successfully detected all corrupt fields in Slot 2");
assert(problems2.some(p => p.includes("studio.cash")), "Flagged corrupt studio.cash");
assert(problems2.some(p => p.includes("bad week counter")), "Flagged bad week counter");
assert(problems2.some(p => p.includes("missing array")), "Flagged missing array");

// 4. Test repairSaveSlots() on slot 2
console.log("\n--- Testing repairSaveSlots() Recovery ---");
const repairLog = repairSaveSlots();
console.log("ℹ️  Repair Log Output:");
repairLog.forEach(line => console.log("   • " + line));

const slot2Repaired = JSON.parse(localStorage.getItem("bow_slot2"));
assert(Array.isArray(slot2Repaired.projects), "Slot 2 projects restored to array");
assert(slot2Repaired.stats !== undefined, "Slot 2 stats object restored");
assert(slot2Repaired.version === 8, "Slot 2 version stamped to 8");

// 5. Test legacy migration from v1 in Slot 3
console.log("\n--- Testing Legacy Migration in Slot 3 ---");
const legacySlot = {
  v: 1,
  week: 12,
  studio: { name: "Vintage 1920s Lot", cash: 50, rep: 40 },
  projects: [],
  films: [],
  series: [],
  offers: [],
  ideas: [],
  franchises: [],
  talent: [{ id: 1, name: "Charlie C", kind: "actor", power: 4, skill: 70 }],
  rivals: [],
  news: []
};
const migrated = migrateSave(legacySlot);
assert(migrated.save.v === DATA.SAVE_VERSION, `Migrated legacy slot from v1 to v${DATA.SAVE_VERSION}`);
assert(migrated.save.talent[0].age !== undefined, "Backfilled talent age during migration");
assert(migrated.save.trends !== undefined, "Seeded genre trends during migration");

console.log("\n=========================================");
console.log(`  ALL ${passedTests}/${totalTests} SAVE SLOT VALIDATION CHECKS PASSED ✅`);
console.log("=========================================\n");
process.exit(0);
