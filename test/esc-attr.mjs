/* test/esc-attr.mjs — esc() must neutralise single quotes too.
 *
 * Bug it pins down: esc() replaced & < > " but not ', while eighteen templates
 * interpolate it into single-quoted attributes (value='"+esc(x)+"'). A title
 * like "Schindler's List" therefore ended the attribute at the apostrophe:
 * the input showed "Schindler" and the rest leaked into the tag, which is how
 * a crafted title becomes an event handler.
 *
 * Loads the real ui.js in jsdom (it touches document at load time), then
 * drives the actual escaping helper and the actual rename modal.
 *
 * Run: node test/esc-attr.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch (e) {
  console.error("❌ esc-attr: jsdom is required for this test. Run: npm install");
  process.exit(1);
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/"use strict";/g, "");

/* ui.js expects a full page; this is the minimum it queries at load. */
const dom = new JSDOM(`<!doctype html><html><body>
  <div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>
</body></html>`, { url: "https://example.test/" });

const win = dom.window;
global.window = win;
global.document = win.document;
/* Node 22 defines a getter-only global navigator; shadow it instead of assigning. */
try { Object.defineProperty(global, "navigator", { value: win.navigator, configurable: true, writable: true }); } catch (e) {}global.HTMLElement = win.HTMLElement;
global.Element = win.Element;
global.Node = win.Node;
global.MouseEvent = win.MouseEvent;
global.Event = win.Event;
global.localStorage = win.localStorage;
global.requestAnimationFrame = win.requestAnimationFrame || ((cb) => setTimeout(cb, 0));
global.__BOWUI = {};

const SHIM = `
if (typeof global.DATA === "undefined") global.DATA = {};
if (typeof global.G === "undefined") global.G = null;
global.toast = function(){};
global.render = function(){};
global.openModal = function(){};
global.closeModal = function(){};
global.saveGame = function(){};
global.log = function(){};
`;

const bundle = SHIM + "\n" + ["data.js", "engine.js", "ui.js"].map(read).join("\n;\n") + "\n;\n" + `
global.__BOWUI = {
  esc: (typeof esc === "function") ? esc : null,
  renameModal: (typeof renameModal === "function") ? renameModal : null,
  renameFilm: (typeof renameFilm === "function") ? renameFilm : null,
  get G(){ return typeof G !== "undefined" ? G : global.G; },
  set G(v){ G = v; },
  newGame: (typeof newGame === "function") ? newGame : null
};
`;

const OUT = path.join(HERE, ".esc-generated.cjs");
fs.writeFileSync(OUT, bundle);
let UI;
try {
  await import(pathToFileURL(OUT).href);
  UI = global.__BOWUI;
} catch (e) {
  console.error("❌ esc-attr: ui.js failed to load — " + e.message);
  try { fs.unlinkSync(OUT); } catch {}
  process.exit(1);
} finally {
  try { fs.unlinkSync(OUT); } catch {}
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

if (!UI.esc) { console.error("❌ esc() not found in ui.js"); process.exit(1); }
const esc = UI.esc;

/* 1 — the apostrophe is the whole bug. */
check("esc() escapes a bare apostrophe", esc("'") === "&#39;", "got " + JSON.stringify(esc("'")));
check("esc() leaves the apostrophe-bearing title readable, not broken",
  esc("Schindler's List") === "Schindler&#39;s List", "got " + JSON.stringify(esc("Schindler's List")));

/* 2 — the existing four must not regress. */
check("esc() still escapes &", esc("a&b") === "a&amp;b");
check("esc() still escapes < and >", esc("<b>") === "&lt;b&gt;");
check("esc() still escapes the double quote", esc('a"b') === "a&quot;b");

/* 3 — hostile input must not survive into markup. */
const hostile = [
  "' onfocus='alert(1)' x='",
  "\"><img src=x onerror=alert(1)>",
  "'); alert(1); //",
  "'/></div><script>alert(1)</script>"
];
hostile.forEach((h, i) => {
  const out = esc(h);
  const clean = !/[<>"]/.test(out) && out.indexOf("'") === -1;
  check("hostile payload " + (i + 1) + " produces no raw quote or angle bracket", clean,
    JSON.stringify(out).slice(0, 70));
});

/* 4 — the real fix: parse the real markup, not the string.
   Build the attribute the way ui.js does and ask the DOM what it sees. */
function attrRoundTrip(value) {
  const div = win.document.createElement("div");
  div.innerHTML = "<input value='" + esc(value) + "' data-title='" + esc(value) + "'>";
  const el = div.querySelector("input");
  return { value: el.getAttribute("value"), title: el.getAttribute("data-title"), handlers: el.getAttributeNames().filter(n => /^on/i.test(n)) };
}

const rt = attrRoundTrip("Schindler's List");
check("a real single-quoted attribute keeps the whole title", rt.value === "Schindler's List",
  JSON.stringify(rt.value));
check("no stray attribute is created by an apostrophe", rt.title === "Schindler's List",
  JSON.stringify(rt.title));

const inject = attrRoundTrip("' onfocus='alert(1)' x='");
check("a crafted title injects no event handler", inject.handlers.length === 0,
  inject.handlers.join(",") || "none");

/* 5 — the actual rename modal, if reachable. */
if (UI.newGame) {
  UI.newGame("indie", "Esc Lab", { scenario: "standard", difficulty: "normal" });
  const G = UI.G;
  if (G && G.films) {
    /* newGame starts with an empty slate; renameModal only needs a film row. */
    G.films.push({ id: 424242, title: "Schindler's List" });
    const f = G.films[0];
    f.title = "Schindler's List";
    if (UI.renameModal) {
      try {
        UI.renameModal("f", f.id);
        const root = win.document.querySelector("#modalRoot");
        const input = root && root.querySelector("#rnInput");
        const attr = input && input.getAttribute("value");
        check("renameModal renders the full apostrophised title into its input",
          attr === "Schindler's List", JSON.stringify(attr));
        check("renameModal's rendered markup contains no bare apostrophe in the attribute",
          !!(root && root.innerHTML.indexOf("value='Schindler'") === -1));
      } catch (e) {
        check("renameModal renders without throwing", false, e.message);
      }
    }
  }
}

if (failures) { console.error("❌ esc-attr: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ esc-attr: all " + checks + " checks passed");
