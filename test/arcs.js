/* Scenario-arc runner.
   UPGRADE-REPORT.md flagged "six scenario arcs never played end-to-end" as an
   evidence gap: they had been exercised by hand in a browser but never made
   repeatable. This scripts all six and asserts the economy stays sane in each.

   Like smoke.js, data.js + engine.js are plain browser scripts sharing one global
   scope; they're concatenated with the arc driver into one generated file so the
   driver can call the engine directly. */
"use strict";
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".arcs-generated.js");

const SHIM = "global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};\nif(typeof global.DATA === 'undefined') global.DATA = {};\n";

const dataJs = fs.readFileSync(path.join(ROOT, "data.js"), "utf8").replace(/"use strict";/g, "");
const engineJs = fs.readFileSync(path.join(ROOT, "engine.js"), "utf8").replace(/"use strict";/g, "");
const arcsBody = fs.readFileSync(path.join(__dirname, "arcs-body.js"), "utf8").replace(/"use strict";/g, "");

fs.writeFileSync(OUT, SHIM + dataJs + "\n" + engineJs + "\n" + arcsBody + "\n");
try{
  require("./.arcs-generated.js");
}finally{
  fs.unlinkSync(OUT);
}
