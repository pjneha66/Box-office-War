/* test/xss-holiday.mjs — the Holiday Release Calendar must escape film titles.
 *
 * Bug it pins down: custom-sandbox.js:372 concatenated f.title / f.genre / f.scale
 * straight into a string that goes to openModal() → innerHTML:
 *     h += "<div class='tiny gold'>• \"" + f.title + "\" (" + f.genre + ...
 * createCustomIdea() only .trim()s the title, so a player-supplied title like
 *     x" onmouseover="alert(1)
 * became live markup in the calendar dialog.
 *
 * The test drives the real openHolidayCalendarModal(), captures the HTML it
 * hands to openModal, and asks the DOM what that markup actually contains.
 *
 * Run: node test/xss-holiday.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

let JSDOM;
try {
  ({ JSDOM } = await import("jsdom"));
} catch (e) {
  console.error("❌ xss-holiday: jsdom is required for this test. Run: npm install");
  process.exit(1);
}

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) { failures++; console.error("❌ " + name + (detail ? " — " + detail : "")); }
  else console.log("✅ " + name + (detail ? " — " + detail : ""));
}

const src = fs.readFileSync(path.join(ROOT, "custom-sandbox.js"), "utf8");

/* A fresh window per scenario: the module captures state at load. */
function loadCalendar(week, projects) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test/",
    runScripts: "outside-only"
  });
  const win = dom.window;
  const captured = { html: null };

  win.woyOf = (w) => (((w - 1) % 52) + 1);
  win.openModal = (html) => { captured.html = html; return null; };
  win.saveGame = () => {};
  win.log = () => {};
  win.render = () => {};
  win.beep = () => {};

  /* The module resolves the game state through BOW_SANDBOX._getG. */
  win.__G = { week: week, projects: projects, films: projects };
  win.eval(src);
  win.BOW_SANDBOX._getG = () => win.__G;
  win.openHolidayCalendarModal();

  return { captured, win };
}

function parse(html) {
  const div = win0.document.createElement("div");
  div.innerHTML = html || "";
  return div;
}
const win0 = new JSDOM("<!doctype html><body></body>").window;

const ATTACK_TITLE = 'x" onmouseover="alert(1)';
const ATTACK_GENRE = "'><img src=x onerror=alert(1)>";
const WEEK = 1;   /* corridor week 1 is always rendered */

/* Put the hostile project in the week-1 corridor so it is actually listed. */
function project(title, genre, scale) {
  return { title: title, genre: genre, scale: scale, releaseWeek: WEEK };
}

/* 1 — the hostile title must not become markup. */
{
  const { captured } = loadCalendar(WEEK, [project(ATTACK_TITLE, ATTACK_GENRE, ATTACK_TITLE)]);
  check("the calendar opened and produced HTML", typeof captured.html === "string" && captured.html.length > 0);

  const el = parse(captured.html);
  const imgs = el.querySelectorAll("img");
  const injected = [];
  el.querySelectorAll("*").forEach(node => {
    node.getAttributeNames().forEach(n => { if (/^on/i.test(n)) injected.push(node.tagName + "@" + n); });
  });

  check("a crafted genre creates no <img> element", imgs.length === 0,
    imgs.length + " found: " + Array.from(imgs).map(i => i.getAttribute("src")).join(","));
  check("a crafted title creates no inline event handler", injected.length === 0,
    injected.join(",") || "none");

  /* 2 — and the text the player actually typed is preserved verbatim. */
  const text = el.textContent || "";
  check("the hostile title survives as literal text", text.indexOf(ATTACK_TITLE) !== -1,
    JSON.stringify(text.slice(0, 120)));
}

/* 3 — an apostrophe (the common real case) must not break the markup either. */
{
  const { captured } = loadCalendar(WEEK, [project("Schindler's List", "drama", "mid")]);
  const el = parse(captured.html);
  check("an apostrophised title renders intact", (el.textContent || "").indexOf("Schindler's List") !== -1);
  check("an apostrophised title injects no element", el.querySelectorAll("img,script").length === 0);
}

/* 4 — the full pipeline: a title created through the real sandbox API. */
{
  const { captured, win } = loadCalendar(WEEK, []);
  const okCreate = win.BOW_SANDBOX.createCustomIdea({ title: ATTACK_TITLE, genre: "action", scale: "mid" }, win.__G);
  check("createCustomIdea accepts the hostile title (so the sink was reachable)", okCreate === true);
  const idea = (win.__G.ideas || [])[0];
  win.__G.projects = [{ title: idea.title, genre: idea.genre, scale: idea.scale, releaseWeek: WEEK }];
  win.openHolidayCalendarModal();
  const el = parse(captured.html);
  const injected = [];
  el.querySelectorAll("*").forEach(node => node.getAttributeNames().forEach(n => { if (/^on/i.test(n)) injected.push(n); }));
  check("a title that came through createCustomIdea is neutralised in the calendar",
    el.querySelectorAll("img").length === 0 && injected.length === 0,
    injected.join(",") || "clean");
}

if (failures) { console.error("❌ xss-holiday: " + failures + "/" + checks + " checks failed"); process.exit(1); }
console.log("✅ xss-holiday: all " + checks + " checks passed");
