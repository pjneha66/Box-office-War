import http from "http";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const ROOT = "/Volumes/PJ DRIVE/open code/Box-office-War-main";
const ARTIFACT_DIR = "/Users/poshstudio/.gemini/antigravity-ide/brain/a892485a-f011-40a8-a907-c412bed9503a";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HTTP_PORT = 8085;
const CDP_PORT = 9226;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 1. Static file server
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split("?")[0]);
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  const filePath = path.join(ROOT, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not Found: " + reqPath);
    return;
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": stat.size
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(HTTP_PORT, "127.0.0.1", async () => {
  console.log("Local HTTP server listening on http://127.0.0.1:" + HTTP_PORT);
  try {
    await runChromeAutomation();
  } catch (err) {
    console.error("Automation error:", err);
  } finally {
    server.close();
    process.exit(0);
  }
});

async function runChromeAutomation() {
  console.log("Starting Chrome Headless on CDP port " + CDP_PORT + "...");
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=/tmp/chrome-landscape-" + Date.now(),
    `http://127.0.0.1:${HTTP_PORT}/index.html`
  ]);

  await sleep(2500);

  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
  const pages = await res.json();
  const page = pages.find(p => p.url && p.url.includes(String(HTTP_PORT))) || pages[0];

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

  // Mobile Landscape: iPhone 14 / modern device landscape (844 x 390, DPR 2)
  await send("Emulation.setDeviceMetricsOverride", {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: {
      angle: 90,
      type: "landscapePrimary"
    }
  });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });

  await sleep(1500);

  // Initialize studio career
  await send("Runtime.evaluate", {
    expression: `(function(){
      SEL = {scenario: "standard", difficulty: "normal", sandbox: false, slot: 1, legacy: ""};
      archSel = DATA.ARCHETYPES[1].id;
      newGame(archSel, "Apex Pictures", {scenario: SEL.scenario, difficulty: SEL.difficulty, sandbox: SEL.sandbox, slot: SEL.slot, legacy: SEL.legacy});
      enterApp(false);
      // Close any first-boot dialogs
      if (typeof closeModal === "function") closeModal();
    })()`
  });

  await sleep(1500);

  // 1. Capture 2D Studio Lot (Campus)
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof switchTab === "function") switchTab("studiolot");
      if (typeof StudioLot2D !== "undefined") StudioLot2D.setView("campus");
    })()`
  });
  await sleep(1500);
  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "landscape_2d_lot_campus.png"), Buffer.from(shot1.data, "base64"));
  console.log("Captured: landscape_2d_lot_campus.png");

  // 2. Capture Soundstage Room
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof StudioLot2D !== "undefined") StudioLot2D.setView("soundstage");
    })()`
  });
  await sleep(1200);
  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "landscape_2d_soundstage.png"), Buffer.from(shot2.data, "base64"));
  console.log("Captured: landscape_2d_soundstage.png");

  // 3. Capture Develop Tab (with authentic Box Office Sim 2 genre icons)
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof switchTab === "function") switchTab("develop");
    })()`
  });
  await sleep(1200);
  const shot3 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "landscape_tab_develop.png"), Buffer.from(shot3.data, "base64"));
  console.log("Captured: landscape_tab_develop.png");

  // 4. Capture Productions Tab
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof switchTab === "function") switchTab("productions");
    })()`
  });
  await sleep(1200);
  const shot4 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "landscape_tab_productions.png"), Buffer.from(shot4.data, "base64"));
  console.log("Captured: landscape_tab_productions.png");

  // 5. Capture Box Office Tab
  await send("Runtime.evaluate", {
    expression: `(function(){
      if (typeof switchTab === "function") switchTab("boxoffice");
    })()`
  });
  await sleep(1200);
  const shot5 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(ARTIFACT_DIR, "landscape_tab_boxoffice.png"), Buffer.from(shot5.data, "base64"));
  console.log("Captured: landscape_tab_boxoffice.png");

  // Close chrome
  try {
    chrome.kill("SIGTERM");
  } catch(e) {}
}
