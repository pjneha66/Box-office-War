/* Re-home check for the game/ UI (4 main tabs + Week, gear menu, Collection inside Playing).
   Boots the real game/index.html in jsdom (same inline-the-scripts approach as test/ui-test.mjs),
   starts a studio, then:
     - checks the bottom bar is Studio · Develop · Week · Playing · Business (no More, no Collection)
     - checks every feature desk is reachable from exactly one main tab / sub-tab, or the gear menu
     - renders every main tab, every Playing sub-tab and every desk, failing on any page error
     - opens the gear sheet and checks it holds save slots + settings
   Run: node test/rehome-tabs.mjs   (exit 1 on any failure) */
"use strict";
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAME = path.join(ROOT, "game");

const html = fs.readFileSync(path.join(GAME, "index.html"), "utf8")
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g, (m, file) => {
    const full = path.join(GAME, file);
    return fs.existsSync(full) ? "<script>" + fs.readFileSync(full, "utf8") + "<\/script>" : m;
  });

const pageErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => pageErrors.push("jsdomError: " + e.message));
vc.on("error", (...a) => pageErrors.push("console.error: " + a.join(" ")));

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
await new Promise(r => setTimeout(r, 1500));
const ev = s => window.eval(s);

let failures = 0, checks = 0;
const check = (name, ok, extra) => {
  checks++;
  console.log((ok ? "PASS" : "FAIL") + "  " + name + (extra != null ? "  ·  " + extra : ""));
  if (!ok) failures++;
};

// start a studio the same way the Start button does
ev('newGame("Rehome Test Studio", "veteran", "std", "free"); VIEW = "studio"; render();');

// 1. bottom bar
const tabs = [...window.document.querySelectorAll("#tabbar .tab, #tabbar .weekBtn")];
const labels = tabs.map(b => (b.querySelector("span") || {}).textContent);
check("bottom bar is Studio · Develop · Week · Playing · Business",
  JSON.stringify(labels) === JSON.stringify(["Studio", "Develop", "Week", "Playing", "Business"]),
  labels.join(" · "));
check("no More or Collection tab in the bar",
  !window.document.querySelector('#tabbar [data-view="more"]') && !window.document.querySelector('#tabbar [data-view="collection"]'));
check("gear button in header", !!window.document.querySelector("#topbar #btnGear"));

// 2. desk placement: every desk in exactly one home
const desks = ev("collectDesks()");
const ids = desks.map(d => d.id);
check("no duplicate desk ids", new Set(ids).size === ids.length, ids.length + " desks");
const placed = ev(`(function(){
  var out = {}; collectDesks().forEach(function(d){ var h = deskHome(d); var k = h.tab + "/" + h.sub; out[k] = (out[k]||0) + 1; out["_ids"] = (out["_ids"]||[]).concat([d.id]); });
  return out;
})()`);
const expectHomes = { "studio/people": 6, "studio/production": 6, "studio/career": 9, "develop/creative": 10, "develop/ip": 4,
  "playing/release": 9, "playing/audience": 7, "playing/awards": 5, "playing/broadcast": 6,
  "business/finance": 5, "business/licensing": 2, "business/empire": 7, "gear/": 2 };
const mismatches = Object.keys(expectHomes).filter(k => (placed[k] || 0) !== expectHomes[k]).map(k => k + "=" + (placed[k] || 0) + "/" + expectHomes[k]);
check("every desk has a home with the expected counts", mismatches.length === 0,
  mismatches.length ? mismatches.join(", ") : Object.keys(expectHomes).map(k => k + " " + expectHomes[k]).join(", "));
const total = Object.keys(placed).filter(k => k !== "_ids").reduce((n, k) => n + placed[k], 0);
check("all desks accounted for (tabs + gear)", total === ids.length, total + " of " + ids.length);

// 3. desk names are unique (duplicate pairs were renamed)
const names = desks.map(d => d.name);
const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
check("desk names are unique", dupNames.length === 0, dupNames.join(", ") || "none");

// 4. render every main tab, Playing sub-tab and desk
const renderOk = (label, expr) => {
  const before = pageErrors.length;
  let len = -1;
  try { len = ev(expr); } catch (e) { pageErrors.push("render " + label + ": " + e.message); }
  check("renders " + label, pageErrors.length === before && typeof len === "number" && len > 0, "html " + len + " chars");
};
ev('VIEW = "studio"; render();');
renderOk("Studio tab", '(function(){ VIEW="studio"; render(); return document.getElementById("view").innerHTML.length; })()');
renderOk("Develop tab", '(function(){ VIEW="develop"; render(); return document.getElementById("view").innerHTML.length; })()');
renderOk("Business tab", '(function(){ VIEW="ledger"; render(); return document.getElementById("view").innerHTML.length; })()');
for (const sub of ["now", "collection", "release", "audience", "awards", "broadcast"]) {
  renderOk("Playing · " + sub, `(function(){ VIEW="playing"; PLAY_TAB="${sub}"; render(); return document.getElementById("view").innerHTML.length; })()`);
}
// Collection must show inside Playing
const collInPlaying = ev('(function(){ VIEW="playing"; PLAY_TAB="collection"; render(); return document.getElementById("view").innerHTML.indexOf("produce-panel") >= 0 || document.getElementById("view").innerHTML.indexOf("bo-empty") >= 0; })()');
check("Collection renders inside Playing", collInPlaying === true);

// every desk opens cleanly from its real render()
let deskFail = [];
ids.forEach(id => {
  const before = pageErrors.length;
  try { ev(`(function(){ var d = findDesk(${JSON.stringify(id)}); if(!d) throw new Error("missing"); LAST_DESK = d; d.render(); })()`); }
  catch (e) { deskFail.push(id + ": " + e.message); }
  if (pageErrors.length !== before) deskFail.push(id + ": page error");
});
check("every desk renders", deskFail.length === 0, deskFail.slice(0, 5).join(" | ") || ids.length + " desks");

// 5. gear sheet holds save slots + settings
ev('openGear();');
const gearHtml = window.document.getElementById("sheetBody").innerHTML;
check("gear sheet opens", !window.document.getElementById("sheetWrap").hidden);
check("gear sheet has save slots", gearHtml.indexOf("Save slots") >= 0 || gearHtml.indexOf("Studio logo") >= 0);
check("gear sheet has settings", gearHtml.indexOf("Theme") >= 0 && gearHtml.indexOf("Sound effects") >= 0);
// Settings must no longer be inside the Business tab
ev('VIEW="ledger"; render();');
check("Business tab no longer carries Settings", window.document.getElementById("view").innerHTML.indexOf("Sound effects") < 0);

// 6. page errors overall
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");

console.log("\n" + (checks - failures) + "/" + checks + " checks passed");
process.exit(failures ? 1 : 0);
