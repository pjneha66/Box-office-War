/* Captures one real, in-game screenshot per change in the premium lot plan.
   Boots a fresh career in headless Chromium, opens the live 2D lot, and drives
   the real UI (buttons, canvas clicks) so nothing in the shots is faked. */
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const OUT = path.resolve('screenshots');
const W = 1440, H = 900;
const URL = process.env.GAME_URL || 'http://127.0.0.1:8080/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/tmp/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--hide-scrollbars'],
    headless: true, protocolTimeout: 120000,
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.split('\n')[0]));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#btnStart', { timeout: 60000 });
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
      const n = document.getElementById('studioName');
      if (n) { n.value = 'Meridian Pictures'; n.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await page.click('#btnStart');
    await page.waitForSelector('#studioLotCanvas', { timeout: 30000 });
    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('studiolot'); });
    await page.waitForFunction(() => {
      const c = document.getElementById('studioLotCanvas');
      return c && c.width > 0 && c.getBoundingClientRect().height > 200;
    }, { timeout: 30000 });
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop,.modal').forEach(e => e.remove()));
    await wait(2600);
    // Settle agents into natural positions, then freeze cosmetics for stable shots.
    await page.evaluate(() => {
      const e = window.StudioLotBridge && window.StudioLotBridge.getEngine();
      if (e) for (let i = 0; i < 240; i++) e.tick(1 / 30);
      document.querySelectorAll('.modal-backdrop,.modal').forEach(x => x.remove());
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
      document.head.appendChild(s);
    });
    await wait(700);

    const shot = async name => {
      await page.evaluate(() => document.querySelectorAll('.modal-backdrop,.modal').forEach(x => x.remove()));
      await wait(350);
      await page.screenshot({ path: path.join(OUT, name) });
      console.log('shot', name);
    };

    /* 1 — Minimap, expanded */
    await shot('01-minimap-expanded.png');

    /* 1 — Minimap, collapsed to its title pill */
    await page.click('#lotMinimapToggle');
    await wait(400);
    await shot('01b-minimap-collapsed.png');
    await page.click('#lotMinimapToggle');
    await wait(400);

    /* 1 — Minimap tap-to-jump: click the far corner, confirm the camera moved */
    const camBefore = await page.evaluate(() => StudioLot2D.getCamera());
    await page.evaluate(() => {
      const cv = document.getElementById('lotMinimapCanvas'), r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.18, clientY: r.top + r.height * 0.72, bubbles: true }));
    });
    await wait(500);
    const camAfter = await page.evaluate(() => StudioLot2D.getCamera());
    console.log('minimap jump moved camera:', camBefore.x !== camAfter.x || camBefore.y !== camAfter.y);
    await shot('01c-minimap-jump.png');
    await page.click('#btnResetView');
    await wait(500);

    /* 2 — Premium glass build dock */
    await page.click('#btnTogglePalette');
    await wait(700);
    await shot('02-build-dock.png');

    /* 3 — Premium ground, whole campus and a close-up */
    await page.click('#btnClosePalette');
    await wait(400);
    await shot('03-premium-ground.png');
    for (let i = 0; i < 6; i++) { await page.click('#btnZoomIn'); await wait(90); }
    await wait(700);
    await shot('03b-premium-ground-closeup.png');
    for (let i = 0; i < 6; i++) { await page.click('#btnZoomOut'); await wait(90); }
    await page.click('#btnResetView');
    await wait(600);

    /* 4 — Train: no station means no rail bed and no train */
    const beforeStation = await page.evaluate(() =>
      StudioLotBridge.getEngine().buildings.some(b => b.b_type === 'train_station'));
    console.log('train present before building a station:', beforeStation);

    /* 4 — Build a station, then let the service run in */
    const placed = await page.evaluate(() => {
      const e = StudioLotBridge.getEngine();
      let res = null;
      for (let y = 0; y <= 2 && !res; y++) {
        for (let x = 3; x < e.cols - 4 && !res; x++) {
          if (e.can_place('train_station', x, y)) res = StudioLotBridge.placeBuilding('train_station', x, y);
        }
      }
      if (!res) return null;
      G.studio.cash -= 12;
      StudioLotBridge.persist(G);
      return { id: res.id, bounds: StudioLot2D.boundsForBuilding(res.id) };
    });
    if (!placed) throw new Error('no free site for the train station');
    console.log('station built, id', placed.id);

    // Centre on the station with a minimap jump, then zoom in so the service is legible.
    await page.evaluate(() => {
      const e = StudioLotBridge.getEngine();
      const s = e.buildings.find(b => b.b_type === 'train_station');
      const cv = document.getElementById('lotMinimapCanvas'), r = cv.getBoundingClientRect();
      const tw = (e.cols + e.rows) * 32 + 64, th = (e.cols + e.rows) * 16 + 32, origin = e.rows * 32;
      const tx = ((s.grid_x + s.span_w / 2) - (s.grid_y + s.span_h / 2)) * 32 + origin;
      const ty = ((s.grid_x + s.span_w / 2) + (s.grid_y + s.span_h / 2)) * 16;
      cv.dispatchEvent(new MouseEvent('click', {
        clientX: r.left + tx / tw * r.width, clientY: r.top + ty / th * r.height, bubbles: true,
      }));
    });
    for (let i = 0; i < 3; i++) { await page.click('#btnZoomIn'); await wait(120); }
    // Let the service run in and dock at the platform.
    await wait(11000);
    await shot('04-train.png');

    // Select the station so the inspector shows the live line and All aboard goal.
    // Bounds must be read after the camera jump and zoom, not before.
    const target = await page.evaluate(id => {
      const c = document.getElementById('studioLotCanvas').getBoundingClientRect();
      const b = StudioLot2D.boundsForBuilding(id);
      return { x: c.left + b.x + b.w / 2, y: c.top + b.y + b.h - 8 };
    }, placed.id);
    await page.mouse.click(target.x, target.y);
    await wait(900);
    await shot('04b-train-station-panel.png');

    const trainState = await page.evaluate(() => ({
      station: StudioLotBridge.getEngine().buildings.some(x => x.b_type === 'train_station'),
      arrivals: (G.studioLot && G.studioLot.trainArrivals) || 0,
      cash: G.studio.cash,
      panel: (document.querySelector('#lotInspectorRoot .lot-train-card') || {}).textContent || null,
    }));
    console.log('train state:', JSON.stringify(trainState));

    console.log(errors.length ? 'PAGE ERRORS:\n' + errors.slice(0, 10).join('\n') : 'no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e); process.exitCode = 1; });
