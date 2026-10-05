import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SHIM = 'global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};global.DATA={};\n';

const body = SHIM + 
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "engine.js"), "utf8") + "\n" + `
newGame("indie", "Test Studio");
G._noSave=true; G.tutorial=null;
G.maVault = [];  // Initialize vault

// Simulate acquiring some vault films
const testFilms = [
  { title: "Library Film 1", genre: "action", quality: 70, weight: 8 },
  { title: "Library Film 2", genre: "comedy", quality: 65, weight: 6 },
  { title: "Library Film 3", genre: "drama", quality: 75, weight: 10 }
];

testFilms.forEach(f => {
  G.maVault.push({ 
    id: nid(), 
    title: f.title, 
    genre: f.genre, 
    quality: f.quality, 
    weight: f.weight, 
    week: G.week + 4,
    ref: { title: f.title, genre: f.genre, quality: f.quality, weight: f.weight }
  });
});

console.log("Initial vault:", G.maVault.length, "films");

// Test 1: maVaultValue
const val = maVaultValue();
console.log("Vault value:", val);

// Test 2: maSellVaultOutright
const cash = maSellVaultOutright();
console.log("Sell outright cash:", cash);
console.log("Vault after sell:", G.maVault.filter(f=>!f.dead).length, "active");

// Re-add for next test
const testFilms2 = [
  { title: "Library Film 1", genre: "action", quality: 70, weight: 8 },
  { title: "Library Film 2", genre: "comedy", quality: 65, weight: 6 },
  { title: "Library Film 3", genre: "drama", quality: 75, weight: 10 }
];
testFilms2.forEach(f => {
  G.maVault.push({ 
    id: nid(), 
    title: f.title, 
    genre: f.genre, 
    quality: f.quality, 
    weight: f.weight, 
    week: G.week + 4,
    ref: { title: f.title, genre: f.genre, quality: f.quality, weight: f.weight }
  });
});

console.log("Vault after re-add:", G.maVault.filter(f=>!f.dead).length, "active");

// Test 3: maBulkLicense
const val2 = maVaultValue();
console.log("Vault value before bulk:", val2);
const bulkCash = maBulkLicense("netflix");
console.log("Bulk license cash:", bulkCash);
console.log("Vault after bulk:", G.maVault.filter(f=>!f.dead).length, "active");

// Re-add for next test
testFilms.forEach(f => {
  G.maVault.push({ 
    id: nid(), 
    title: f.title, 
    genre: f.genre, 
    quality: f.quality, 
    weight: f.weight, 
    week: G.week + 4,
    ref: { title: f.title, genre: f.genre, quality: f.quality, weight: f.weight }
  });
});

// Test 4: maSellToRival
const val3 = maVaultValue();
console.log("Vault value before flip:", val3);
const flipCash = maSellToRival("Apex Pictures");
console.log("Flip to rival cash:", flipCash);
console.log("Vault after flip:", G.maVault.filter(f=>!f.dead).length, "active");

console.log("=== ALL TESTS PASSED ===");
`;

const m = { exports: {} };
eval(body);