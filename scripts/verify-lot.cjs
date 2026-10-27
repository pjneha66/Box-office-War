/* Pixel-level verification of the four lot changes, sampled from the live canvas. */
const puppeteer = require('puppeteer-core');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/tmp/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'],
    headless: true, protocolTimeout: 120000,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('#btnStart', { timeout: 60000 });
    await page.click('#btnStart');
    await page.waitForSelector('#studioLotCanvas', { timeout: 30000 });
    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('studiolot'); });
    await wait(3000);
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop,.modal').forEach(e => e.remove()));

    const ground = await page.evaluate(() => {
      const cv = document.getElementById('studioLotCanvas');
      const c = cv.getContext('2d');
      const dpr = cv.width / cv.getBoundingClientRect().width;
      // Sample a band across the middle of the lot, where turf and hardscape both appear.
      const x0 = Math.round(cv.width * 0.30), y0 = Math.round(cv.height * 0.45);
      const w = Math.round(cv.width * 0.40), h = Math.round(cv.height * 0.25);
      const d = c.getImageData(x0, y0, w, h).data;
      const seen = new Set(); const tones = {};
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const key = (d[i] >> 2) + ',' + (d[i + 1] >> 2) + ',' + (d[i + 2] >> 2);
        seen.add(key); tones[key] = (tones[key] || 0) + 1;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
      const top = Object.entries(tones).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([k, v]) => k.split(',').map(t => t * 4).join(',') + ' x' + v);
      return { distinctColours: seen.size, meanRGB: [Math.round(r / n), Math.round(g / n), Math.round(b / n)], dominant: top, dpr };
    });

    const minimap = await page.evaluate(() => {
      const cv = document.getElementById('lotMinimapCanvas');
      if (!cv) return { error: 'no minimap canvas' };
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let gold = 0, opaque = 0, dots = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 10) opaque++;
        // #edce7d facility dots / #f7ead1 camera frame
        if (d[i] > 200 && d[i + 1] > 170 && d[i + 1] < 230 && d[i + 2] > 100 && d[i + 2] < 190) gold++;
        if (d[i] > 225 && d[i + 1] > 195 && d[i + 2] < 175) dots++;
      }
      return { size: [cv.width, cv.height], opaquePixels: opaque, goldishPixels: gold, brightPixels: dots };
    });

    const dock = await page.evaluate(() => {
      document.getElementById('btnTogglePalette').click();
      const d = document.querySelector('#lotPaletteRoot .lot-build-dock');
      if (!d) return { error: 'no dock' };
      const cs = getComputedStyle(d), stage = document.getElementById('studiolotGlobalStage').getBoundingClientRect();
      const box = d.getBoundingClientRect();
      return {
        backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
        radius: cs.borderRadius,
        cards: [...d.querySelectorAll('.lot-build-card')].map(c => ({
          type: c.dataset.btype, state: c.dataset.state,
          price: c.querySelector('.lot-build-price').textContent,
          badge: c.querySelector('.lot-build-badge').textContent,
          note: c.querySelector('.lot-build-note').textContent,
        })),
        bottomGap: Math.round(stage.bottom - box.bottom),
        aboveDeck: box.bottom <= document.querySelector('.kairo-bottom-deck').getBoundingClientRect().top,
      };
    });

    const train = await page.evaluate(async () => {
      const cv = document.getElementById('studioLotCanvas'), c = cv.getContext('2d');
      const sample = () => {
        // North edge band, outside the build grid, where the rail runs.
        const d = c.getImageData(0, 0, cv.width, Math.round(cv.height * 0.42)).data;
        let body = 0, roof = 0, ballast = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          if (Math.abs(R - 0x3f) < 12 && Math.abs(G - 0x5c) < 12 && Math.abs(B - 0x6b) < 12) body++;
          if (Math.abs(R - 0x6f) < 12 && Math.abs(G - 0x93) < 12 && Math.abs(B - 0xa3) < 12) roof++;
          if (Math.abs(R - 0x6d) < 10 && Math.abs(G - 0x6b) < 10 && Math.abs(B - 0x60) < 10) ballast++;
        }
        return { body, roof, ballast, sig: d.length };
      };
      const beforeData = c.getImageData(0, 0, cv.width, Math.round(cv.height * 0.42)).data.slice();
      const before = sample();
      const e = StudioLotBridge.getEngine();
      let res = null;
      for (let y = 0; y <= 2 && !res; y++) for (let x = 3; x < e.cols - 4 && !res; x++) {
        if (e.can_place('train_station', x, y)) res = StudioLotBridge.placeBuilding('train_station', x, y);
      }
      if (!res) return { error: 'no site', before };
      await new Promise(r => setTimeout(r, 2500));
      const afterData = c.getImageData(0, 0, cv.width, Math.round(cv.height * 0.42)).data;
      let changed = 0;
      for (let i = 0; i < afterData.length; i += 4) {
        if (Math.abs(afterData[i] - beforeData[i]) > 8 || Math.abs(afterData[i + 1] - beforeData[i + 1]) > 8 || Math.abs(afterData[i + 2] - beforeData[i + 2]) > 8) changed++;
      }
      const after = sample();
      return {
        stationId: res.id,
        beforeStation: before,
        afterStation: after,
        railAppeared: after.ballast > before.ballast + 200,
        pixelsChanged: changed,
      };
    });

    console.log(JSON.stringify({ ground, minimap, dock, train }, null, 1));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e); process.exitCode = 1; });
