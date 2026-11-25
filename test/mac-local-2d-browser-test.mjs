// Test 2D Studio Lot Engine directly in Chrome via Chrome DevTools Protocol (CDP)
import fs from "fs";
import assert from "node:assert/strict";

async function main() {
  const debugUrl = process.env.CHROME_DEBUG_URL || "http://localhost:9222";
  const gameUrl = process.env.GAME_URL || "http://localhost:8085";
  console.log("[MAC LOCAL TEST] Connecting to Chrome CDP at", debugUrl);
  const res = await fetch(new URL("/json", debugUrl));
  const pages = await res.json();
  const page = pages.find(target => target.type === "page" && target.url && new URL(target.url).origin === new URL(gameUrl).origin);
  if (!page) {
    throw new Error("Could not find Box Office War page in Chrome targets");
  }

  console.log("[MAC LOCAL TEST] Found page:", page.title, page.url);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    const id = idCounter++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Enable network and bypass service worker cache to ensure freshest files
  await send("Network.enable");
  await send("Network.clearBrowserCache");
  await send("Network.setBypassServiceWorker", { bypass: true });
  await send("Page.reload", { ignoreCache: true });
  await new Promise(r => setTimeout(r, 1200));

  // Set viewport
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Evaluate startup
  console.log("[MAC LOCAL TEST] Clicking Launch Studio Career...");
  const bootRes = await send("Runtime.evaluate", {
    expression: `(function(){
      if (document.getElementById("btnStart")) {
        document.getElementById("btnStart").click();
      } else if (typeof enterApp === "function") {
        enterApp(true);
      }
      switchTab("studiolot");
      closeModal();
      return {
        appVisible: document.getElementById("app")?.style.display !== "none",
        tab: typeof TAB !== "undefined" ? TAB : null,
        canvasExists: !!document.getElementById("studioLotCanvas")
      };
    })()`,
    returnByValue: true
  });
  console.log("[MAC LOCAL TEST] Boot state:", bootRes.result.value);

  // Wait 1.5 seconds for 2D lot canvas to mount and draw
  await new Promise(r => setTimeout(r, 1500));

  // Verify lot state and HUD
  const lotState = await send("Runtime.evaluate", {
    expression: `(function(){
      const canvas = document.getElementById("studioLotCanvas");
      const hudName = document.getElementById("lotHudStudioName")?.textContent;
      const hudCash = document.getElementById("lotHudCash")?.textContent;
      const hudDate = document.getElementById("lotHudDate")?.textContent;
      const activeShoots = document.getElementById("lotHudStages")?.textContent;
      
      return {
        canvasW: canvas ? canvas.width : 0,
        canvasH: canvas ? canvas.height : 0,
        hudName,
        hudCash,
        hudDate,
        activeShoots
      };
    })()`,
    returnByValue: true
  });
  console.log("[MAC LOCAL TEST] 2D Lot Canvas & HUD:", lotState.result.value);
  assert(lotState.result.value.canvasW > 0 && lotState.result.value.canvasH > 0, "Studio Lot canvas must render");

  // Test In-Canvas Advance Week
  console.log("[MAC LOCAL TEST] Clicking In-Canvas Next Week (+1W)...");
  const nextRes = await send("Runtime.evaluate", {
    expression: `(function(){
      const btn = document.getElementById("btnLotNextWeek");
      const before = G.week;
      if (btn) btn.click();
      return {
        before,
        week: typeof G !== "undefined" && G ? G.week : null,
        cash: typeof G !== "undefined" && G && G.studio ? G.studio.cash : null
      };
    })()`,
    returnByValue: true
  });
  console.log("[MAC LOCAL TEST] Advanced Week Result:", nextRes.result.value);
  assert.equal(nextRes.result.value.week, nextRes.result.value.before + 1);

  // Wait 500ms for floating texts and canvas render
  await new Promise(r => setTimeout(r, 500));

  const selection = await send("Runtime.evaluate", {
    expression: `(() => {
      closeModal();
      StudioLot2D.setView("campus");
      const canvas = document.getElementById("studioLotCanvas");
      const rect = canvas.getBoundingClientRect();
      const point = StudioLot2D.project(5.5, 5.5);
      return { x: rect.left + point.x, y: rect.top + point.y };
    })()`,
    returnByValue: true
  });
  const point = selection.result.value;
  await send("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...point });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...point });
  const inspector = await send("Runtime.evaluate", {
    expression: 'Boolean(document.querySelector("#lotVisit")?.getClientRects().length)',
    returnByValue: true
  });
  assert.equal(inspector.result.value, true, "Selecting a lot building opens its inspector");

  // Capture Screenshot of live 2D Studio Lot with Inspector open
  console.log("[MAC LOCAL TEST] Capturing live 2D Canvas screenshot with inspector...");
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("mac-local-2d-lot.png", Buffer.from(shot.data, "base64"));
  console.log("[MAC LOCAL TEST] Screenshot saved to mac-local-2d-lot.png!");

  ws.close();
  console.log("[MAC LOCAL TEST] Test complete with 0 errors!");
}

main().catch(err => {
  console.error("[MAC LOCAL TEST] FAILED:", err);
  process.exit(1);
});
