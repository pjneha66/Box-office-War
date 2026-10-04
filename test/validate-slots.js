#!/usr/bin/env node
/**
 * test/validate-slots.js
 * Standalone Node script that validates bow_slotN records and outputs corrupt fields.
 * Tests integrity of save slot records, validates schema version, and tests repair mechanisms.
 * Loads data.js + engine.js + slots-body.js as one generated bundle (static require, no vm).
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".slots-generated.js");

// In-memory localStorage mock for headless node execution
const SHIM = "const storage={};global.localStorage={getItem:(k)=>(storage.hasOwnProperty(k)?storage[k]:null),setItem:(k,v)=>{storage[k]=String(v);},removeItem:(k)=>{delete storage[k];},clear:()=>{Object.keys(storage).forEach(k=>delete storage[k]);}};\n";

const bundle = SHIM +
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(ROOT, "engine.js"), "utf8") + "\n" +
  fs.readFileSync(path.join(__dirname, "slots-body.js"), "utf8") + "\n";

fs.writeFileSync(OUT, bundle);
try{
  require("./.slots-generated.js");
}finally{
  fs.unlinkSync(OUT);
}
