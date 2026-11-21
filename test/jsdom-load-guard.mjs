import { JSDOM } from "jsdom";
import http from "http";

const dom = new JSDOM("", { url: "http://127.0.0.1:8123/game/index.html", resources: "usable", runScripts: "dangerously" });
const errors = [];
const warnings = [];
dom.window.console.error = (...a) => errors.push(a.join(" "));
dom.window.console.warn = (...a) => warnings.push(a.join(" "));
Object.defineProperty(dom.window, "localStorage", { value: { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } }, writable: true });

http.get("http://127.0.0.1:8123/game/index.html", res => {
  let d = ""; res.on("data", c => d += c); res.on("end", () => {
    dom.window.document.open(); dom.window.document.write(d); dom.window.document.close();
    setTimeout(() => {
      if (errors.length) { console.error("FAIL jsdom load guard:", errors.slice(0, 5)); process.exit(1); }
      console.log("PASS jsdom load guard — 0 console errors");
      process.exit(0);
    }, 8000);
  });
});