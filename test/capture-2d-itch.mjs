import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "/Users/poshstudio/.gemini/antigravity-ide/brain/39371e33-3126-4d61-9ca3-5b7e48beebab";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9225;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log("Starting Chrome Headless on port " + PORT + "...");
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/chrome-test-profile-" + Date.now(),
    "http://localhost:8085/index.html"
  ], { detached: true });

  await sleep(2500);

  const res = await fetch(`http://localhost:${PORT}/json`);
  const pages = await res.json();
  const page = pages.find(p => p.url && p.url.includes("8085")) || pages[0];

  console.log("Connected to page:", page.title, page.url);
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

  await send("Page.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  await sleep(1500);

  // 1. Capture Start Screen
  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "itch_screen_1_start.png"), Buffer.from(shot1.data, "base64"));
  console.log("Captured: itch_screen_1_start.png");

  // 2. Launch Studio Career into 2D Lot
  await send("Runtime.evaluate", {
    expression: `(function(){
      const btn = document.getElementById("btnStart");
      if (btn) btn.click();
    })()`
  });

  await sleep(2000);

  // Ensure 2D Lot tab is active
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.switchTab === "function") window.switchTab("studiolot");
    })()`
  });

  await sleep(1500);

  // 2. Capture 2D Studio Lot (Campus)
  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "kairo_screen_campus.png"), Buffer.from(shot2.data, "base64"));
  console.log("Captured: kairo_screen_campus.png");

  // 2b. Switch to Soundstage View
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.StudioLot2D !== "undefined") window.StudioLot2D.setView("soundstage");
    })()`
  });
  await sleep(1500);
  const shotStage = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "kairo_screen_soundstage.png"), Buffer.from(shotStage.data, "base64"));
  console.log("Captured: kairo_screen_soundstage.png");

  // 2c. Switch to Writers Room View
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.StudioLot2D !== "undefined") window.StudioLot2D.setView("writers");
    })()`
  });
  await sleep(1000);
  const shotWriters = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "kairo_screen_writers.png"), Buffer.from(shotWriters.data, "base64"));
  console.log("Captured: kairo_screen_writers.png");

  // 2d. Switch to Post View
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.StudioLot2D !== "undefined") window.StudioLot2D.setView("post");
    })()`
  });
  await sleep(1000);
  const shotPost = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "kairo_screen_post.png"), Buffer.from(shotPost.data, "base64"));
  console.log("Captured: kairo_screen_post.png");

  // 2e. Switch to Cinema Theater View
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.StudioLot2D !== "undefined") window.StudioLot2D.setView("cinema");
    })()`
  });
  await sleep(1000);
  const shotCinema = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "kairo_screen_cinema.png"), Buffer.from(shotCinema.data, "base64"));
  console.log("Captured: kairo_screen_cinema.png");

  // 3. Open Settings Modal
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.settingsModal === "function") window.settingsModal();
      else {
        const btn = document.getElementById("btnSettings");
        if (btn) btn.click();
      }
    })()`
  });

  await sleep(1000);

  const shot3 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "itch_screen_3_modal.png"), Buffer.from(shot3.data, "base64"));
  console.log("Captured: itch_screen_3_modal.png");

  // 4. Close modal and navigate to Productions Tab
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof window.closeModal === "function") window.closeModal();
      if (typeof window.switchTab === "function") window.switchTab("productions");
    })()`
  });

  await sleep(1500);

  const shot4 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "itch_screen_4_productions.png"), Buffer.from(shot4.data, "base64"));
  console.log("Captured: itch_screen_4_productions.png");

  // Cleanup
  ws.close();
  try {
    process.kill(-chrome.pid);
  } catch (e) {
    try { chrome.kill(); } catch (e2) {}
  }

  console.log("Visual verification capture complete.");
  process.exit(0);
}

run().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
