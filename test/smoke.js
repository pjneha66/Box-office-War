/* Headless smoke test runner.
   data.js and engine.js are plain browser scripts sharing one global scope.
   To run them under Node, this runner assembles both plus the AI driver
   (smoke-body.js) into one generated script — a single shared scope — then
   loads it with a static require and removes it again. */
"use strict";
const fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, ".smoke-generated.js");

const SHIM = "global.localStorage={_s:{},getItem(k){return this._s[k]??null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}};\nif(typeof global.DATA === 'undefined') global.DATA = {};\n";

const dataJs = fs.readFileSync(path.join(ROOT, "data.js"), "utf8").replace(/"use strict";/g, "");
const engineJs = fs.readFileSync(path.join(ROOT, "engine.js"), "utf8").replace(/"use strict";/g, "");
const smokeBodyJs = fs.readFileSync(path.join(__dirname, "smoke-body.js"), "utf8").replace(/"use strict";/g, "");

const bundle = SHIM +
  dataJs + "\n" +
  engineJs + "\n" +
  smokeBodyJs + "\n";

fs.writeFileSync(OUT, bundle);
try{
  require("./.smoke-generated.js");
}finally{
  fs.unlinkSync(OUT);
}
