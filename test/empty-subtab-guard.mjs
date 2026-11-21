import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const ui = fs.readFileSync(path.join(root, "game", "ui.js"), "utf8");
const start = ui.indexOf("var DESK_GROUPS = {");
const end = ui.indexOf("};", start) + 2;
const block = ui.slice(start, end);
const mapped = new Set();
for (const m of block.matchAll(/groups:\s*\[([^\]]*)\]/g)) {
  for (const g of m[1].matchAll(/"([^"]+)"/g)) mapped.add(g[1]);
}
const groups = new Set();
for (const f of fs.readdirSync(path.join(root, "game")).filter(x => x.endsWith(".js"))) {
  const txt = fs.readFileSync(path.join(root, "game", f), "utf8");
  for (const m of txt.matchAll(/group:\s*"([^"]+)"/g)) groups.add(m[1]);
}
const gear = new Set(["Slots", "Help"]);
const missing = [...mapped].filter(g => !groups.has(g) && !gear.has(g));
if (missing.length) {
  console.error("FAIL: mapped groups with no desks:", missing);
  process.exit(1);
}
console.log("PASS empty-subtab guard — all mapped groups have desks");