import { JSDOM } from "jsdom";
import http from "http";
import fs from "fs";

const dom = new JSDOM("", { url: "http://127.0.0.1:8123/game/index.html", resources: "usable", runScripts: "dangerously" });
http.get("http://127.0.0.1:8123/game/index.html", res => {
  let d = ""; res.on("data", c => d += c); res.on("end", () => {
    dom.window.document.open(); dom.window.document.write(d); dom.window.document.close();
    const w = dom.window;
    setTimeout(() => {
      try {
        w.localStorage.clear();
        w.document.querySelector("#studioName").value = "Test";
        w.document.querySelector('[data-action="pick-origin"][data-origin="veteran"]').click();
        w.document.querySelector('[data-action="start-game"]').click();
        w.S.films.push({ id: 999, title: "Test Film", status: "run", scale: "mid", ww: 0, collection: { cost: 0, totals: {} } });
        w.VIEW = "playing"; w.PLAY_TAB = "collection"; w.render();
        const btn = w.document.querySelector('[data-boc-bump="pushScreens"]');
        if (!btn) { console.error("FAIL: lever button not found"); process.exit(1); }
        const before = w.S.studio.cash;
        btn.click();
        setTimeout(() => {
          const film = w.S.films.find(f => f.id === 999);
          const rec = w.S.collection.bump["999"].pushScreens;
          if (!rec || rec.weeksLeft !== 8) { console.error("FAIL: lever record not written", JSON.stringify(rec)); process.exit(1); }
          if (!(w.S.studio.cash < before)) { console.error("FAIL: cash did not decrease"); process.exit(1); }
          console.log("PASS collection click guard");
          process.exit(0);
        }, 500);
      } catch (e) { console.error("ERR", e && e.stack); process.exit(1); }
    }, 10000);
  });
});