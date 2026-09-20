// Box Office War — UI Tests
// Run: node test/ui-test.mjs

import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
const doc = dom.window.document;

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

// Test 1: HTML loads
assert(doc !== null, 'HTML loads');

// Test 2: Root element exists
assert(doc.querySelector('#root') !== null, 'Root element exists');

// Test 3: Title is set
assert(doc.title === 'Box Office War', 'Title is set');

// Test 4: Has main sections
assert(doc.querySelector('#dashboard') !== null, 'Dashboard section exists');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
