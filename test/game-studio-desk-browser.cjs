/* GAME STUDIO DESK responsive browser verification (screenshots out of Git):
   every section at 320/390/414/844/1024/1440 — zero doc/#view/deck overflow,
   no clipped panel children, no legacy chrome, no console errors, bottom-nav
   clearance at 390px, offline (external requests blocked), screenshots to
   /tmp/gamestudio-shots. Mirrors test/library-desk-browser.cjs.

   Requires puppeteer-core + @sparticuz/chromium (dev/CI deps, not installed in
   every sandbox) and an app server already serving the repo root on :3000
   (e.g. `npm run serve:nocache`). It is intentionally NOT part of the default
   `test:management` chain so a machine without those heavy deps still passes.
*/
const assert = require('node:assert/strict');
const fs = require('node:fs');
let puppeteer, chromium;
try {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium').default;
} catch (e) {
  console.error('SKIP game-studio-desk-browser: puppeteer-core / @sparticuz/chromium not installed here.');
  console.error('      Run it in CI/dev after `npm i -D puppeteer-core @sparticuz/chromium`.');
  process.exit(0);
}
const OUT = '/tmp/gamestudio-shots';
(async () => {
  if (process.platform === 'linux') {
    const { inflate } = await import('../node_modules/@sparticuz/chromium/build/lambdafs.js');
    const { resolve } = require('node:path');
    await inflate(resolve('node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
    process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH || ''].join(':');
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || await chromium.executablePath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true
  });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) || u.startsWith('data:') || u.startsWith('blob:')) r.continue();
      else r.abort();
    });
    await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000/', { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(() => {
      SEL = { scenario: 'standard', difficulty: 'normal', sandbox: false, slot: 1, legacy: '' };
      newGame(DATA.ARCHETYPES[1].id, 'Game Studio Desk Browser', SEL);
      enterApp(false); closeModal();
      G.studio.cash = 600; G.studio.rep = 64; G.week = 64;
      /* found the studio, seed a greenlit project + a couple of shipped titles
         so every panel has real content at every breakpoint */
      if (typeof foundGameStudio === 'function') foundGameStudio();
      else if (window.GameStudioDesk && GameStudioDesk.found) GameStudioDesk.found(G);
      if (window.GameStudioDesk && GameStudioDesk.greenlight) {
        GameStudioDesk._setRng(() => 0.5);
        try { GameStudioDesk.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu' }); } catch (e) {}
      }
      GAMES_SUB = 'overview';
      switchTab('games'); render();
    });
    const subs = ['overview', 'develop', 'catalog', 'studio', 'contracts', 'awards', 'hardware'];
    const widths = [[320, 780], [390, 844], [414, 896], [844, 414], [1024, 768], [1440, 950]];
    for (const [width, height] of widths) {
      await page.setViewport({ width, height });
      for (const sub of subs) {
        await page.evaluate(s => { G.gameStudioDesk.sub = s; GAMES_SUB = s; render(); window.scrollTo(0, 0); }, sub);
        await new Promise(r => setTimeout(r, 100));
        const m = await page.evaluate(() => {
          const de = document.documentElement, view = document.querySelector('#view'), deck = document.querySelector('.command-games');
          const vr = view.getBoundingClientRect();
          const clipped = [];
          if (deck) deck.querySelectorAll('.produce-panel, .games-row, .games-staff-row, .games-contract, .games-item, .games-award, .command-metric, .command-heading, .command-section-nav').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width && (r.right > vr.right + 1.5 || r.left < vr.left - 1.5)) clipped.push((el.className || '?').toString().slice(0, 40) + ':' + Math.round(r.right - vr.right));
          });
          return {
            docOverflow: de.scrollWidth - window.innerWidth,
            viewOverflow: view.scrollWidth - view.clientWidth,
            deckOverflow: deck ? deck.scrollWidth - deck.clientWidth : 999,
            clipped: clipped.slice(0, 5),
            chips: document.querySelectorAll('[data-gamessub]').length,
            legacy: document.querySelectorAll('#view .card, #view .section-title, #view .cost-line, #view .stat-hero, #view .subnav-pills').length,
            hasDeck: !!deck,
            heading: (document.querySelector('.command-edition') || {}).textContent || ''
          };
        });
        assert(m.hasDeck, `${sub}@${width}: command-games missing`);
        assert(m.heading.includes('GAME STUDIO DESK'), `${sub}@${width}: desk header missing`);
        assert.equal(m.chips, 7, `${sub}@${width}: seven chips (got ${m.chips})`);
        assert(m.docOverflow <= 1, `${sub}@${width}: document overflow ${m.docOverflow}px`);
        assert(m.viewOverflow <= 1, `${sub}@${width}: #view overflow ${m.viewOverflow}px`);
        assert(m.deckOverflow <= 1, `${sub}@${width}: command deck overflow ${m.deckOverflow}px`);
        assert.deepEqual(m.clipped, [], `${sub}@${width}: clipped children ${m.clipped.join(',')}`);
        assert.equal(m.legacy, 0, `${sub}@${width}: legacy chrome leaked into the desk (${m.legacy})`);
      }
      console.log(`PASS width ${width}: all seven sections, zero overflow/clipping`);
    }
    /* 390px: final panel clears the fixed bottom navigation */
    await page.setViewport({ width: 390, height: 844 });
    for (const sub of subs) {
      await page.evaluate(s => { G.gameStudioDesk.sub = s; GAMES_SUB = s; render(); }, sub);
      const clear = await page.evaluate(() => {
        const nav = document.querySelector('.bottomnav');
        const panels = [...document.querySelectorAll('.command-games .produce-panel')];
        const last = panels[panels.length - 1];
        window.scrollTo(0, 999999);
        const lr = last ? last.getBoundingClientRect() : { bottom: 0 };
        const nr = nav ? nav.getBoundingClientRect() : { top: innerHeight };
        return { gap: Math.round(nr.top - lr.bottom), navFound: !!nav };
      });
      assert(clear.gap >= 0, `${sub}@390: last panel clears bottom nav (gap ${clear.gap}px, nav found: ${clear.navFound})`);
    }
    console.log('PASS 390px: final panel clears the fixed bottom navigation on every section');
    /* screenshots: mobile + desktop */
    for (const [width, height, tag] of [[390, 844, 'mobile'], [1440, 950, 'desktop']]) {
      await page.setViewport({ width, height });
      for (const sub of subs) {
        await page.evaluate(s => { G.gameStudioDesk.sub = s; GAMES_SUB = s; render(); window.scrollTo(0, 0); }, sub);
        await new Promise(r => setTimeout(r, 120));
        await page.screenshot({ path: `${OUT}/games-${sub}-${tag}-top.png` });
      }
    }
    console.log('screenshots → ' + OUT + ' (' + fs.readdirSync(OUT).length + ' files)');
    assert.deepEqual(errors, [], 'console/page errors: ' + errors.join(' ; '));
    console.log('PASS game-studio browser: responsive + offline (external requests blocked) + screenshots');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
