/* GAME STUDIO DESK (v37) regressions — bug fixes + full Kairo loop.
   Runs offline in two layers:
     1. Pure-engine unit tests (require the module, deterministic RNG, fabricated state).
     2. jsdom UI tests against the local app shell (no network, external reqs ignored).
   Mirrors test/library-desk.mjs and test/empire-desk.mjs conventions. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const D = require('../gamestudio-desk.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  ✗ FAIL:', m); } };
const eq = (a, b, m) => ok(a === b, `${m} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= (tol || 1e-6), `${m} — got ${a}, ~${b}`);
const NS = (cash) => ({ week: 1, studio: { cash: cash == null ? 500 : cash, rep: 50 }, news: [], gamesDiv: { unlocked: false }, weekTx: {}, franchises: [], films: [] });
function foundState(cash) { D._setRng(() => 0.5); const G = NS(cash); D.found(G); return G; }
function toDebug(G) { let guard = 0; while (G.gameStudioDesk.active && G.gameStudioDesk.active.phase !== 'debug' && guard++ < 120) D.tick(G); return G.gameStudioDesk.active; }

/* ══════════════════════ 1. ENGINE UNIT TESTS ══════════════════════ */
try {
  /* founding seeds a 4-person crew, 30 data, syncs the v16 division */
  {
    const G = NS(500); D._setRng(() => 0.5);
    const r = D.found(G);
    ok(r.ok, 'found() succeeds');
    ok(D.isFounded(G), 'isFounded true after founding');
    eq(G.gameStudioDesk.staff.length, 4, 'starter crew of 4');
    eq(G.gameStudioDesk.researchData, 30, 'seeded research data');
    near(G.studio.cash, 450, 0.001, '$50M founding fee charged');
    ok(G.gamesDiv && G.gamesDiv.unlocked, 'v16 gamesDiv synced on founding');
    const again = D.found(G);
    ok(!again.ok, 'cannot found twice');
  }

  /* Full loop: plan → phases → bugs→data → release → review/40 → sales */
  {
    const G = foundState(); D._setRng(() => 0.05);
    const gl = D.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu', directions: { innovation: 3, polish: 3 } });
    ok(gl.ok, 'greenlight a game');
    ok(G.gameStudioDesk.active, 'active project set');
    const p = toDebug(G);
    eq(p.phase, 'debug', 'reaches Debug milestone');
    ok(p.fun > 0 && p.cre > 0 && p.gfx > 0 && p.snd > 0, 'all four parameters generated across phases');
    ok(p.bugs > 0, 'bugs generated with bug-prone RNG');
    const dataBefore = G.gameStudioDesk.researchData;
    const sq = D.squashBugs(G, 2);
    ok(sq.ok, 'squash bugs');
    eq(G.gameStudioDesk.researchData, dataBefore + sq.squashed, 'each squashed bug = +1 data');
    eq(sq.squashed, 2, 'squashed exactly 2');
    const rel = D.release(G);
    ok(rel.ok, 'release the game');
    ok(rel.review.total >= 4 && rel.review.total <= 40, 'review total in 4..40');
    eq(rel.game.judges.length, 4, 'four critics');
    eq(G.gameStudioDesk.catalog.length, 1, 'one title in catalog');
    ok(rel.game.units > 0 && rel.game.revenue > 0, 'units & revenue computed');
    ok(Array.isArray(rel.game.salesPlan) && rel.game.salesPlan.length >= 8, 'sales decay plan has ≥8 weeks');
    ok(rel.game.salesPlan[0] >= (rel.game.salesPlan[1] || 0), 'week 1 is the biggest shipment');
  }

  /* Genre × theme synergy: great > neutral > disaster (equal params) */
  {
    const G = NS(); D._setRng(() => 0.5);
    const base = { directions: {}, fun: 50, cre: 50, gfx: 50, snd: 50, bugs: 0, hype: 20, platform: 'pc' };
    const great = D.reviewOf({ ...base, genre: 'rpg', theme: 'fantasy' }, G, false).total;
    const neutral = D.reviewOf({ ...base, genre: 'rpg', theme: 'town' }, G, false).total;
    const disaster = D.reviewOf({ ...base, genre: 'educational', theme: 'zombie' }, G, false).total;
    ok(great > neutral, 'great synergy beats neutral');
    ok(neutral > disaster, 'neutral beats disaster pairing');
    eq(D.synergyOf('rpg', 'fantasy').tier, 'great', 'rpg+fantasy is a great combo');
    eq(D.synergyOf('educational', 'zombie').tier, 'disaster', 'educational+zombie is a disaster');
  }

  /* Consecutive-assignment burnout */
  {
    near(D.burnoutFactor('leadA', 'leadA'), 0.4, 1e-9, 'repeat lead → ×0.40 output');
    near(D.burnoutFactor('leadA', 'leadB'), 1.0, 1e-9, 'alternate lead → ×1.0');
    near(D.burnoutFactor(null, 'leadA'), 1.0, 1e-9, 'no previous lead → ×1.0');
  }

  /* Market saturation across two identical releases */
  {
    const G = foundState(); D._setRng(() => 0.5);
    const quick = (gen, th) => { D.greenlight(G, { genre: gen, theme: th, platform: 'pc', author: 'gaichu' }); if (G.gameStudioDesk.active) { G.gameStudioDesk.active.progress = 100; G.gameStudioDesk.active.phase = 'debug'; G.gameStudioDesk.active.bugs = 0; } return D.release(G); };
    quick('rpg', 'fantasy'); quick('rpg', 'fantasy');
    const sat = D.saturation(G);
    ok(sat.sameGenre && sat.sameTheme && sat.both, 'consecutive same genre & theme flagged');
    near(sat.firstWeekMult, 0.6, 1e-9, 'both-repeated → first-week sales ×0.60');
  }

  /* Career tree: level with data, gated tiers */
  {
    const G = foundState();
    const st = G.gameStudioDesk.staff[0];
    const cost = D.jobLevelDataCost(G, st, 'coder');
    const before = G.gameStudioDesk.researchData;
    const r = D.levelUpJob(G, st.id, 'coder');
    ok(r.ok, 'level up a base job');
    eq(st.levels.coder, 2, 'coder is now Lv2');
    eq(G.gameStudioDesk.researchData, before - cost, 'data cost deducted');
    ok(!D.canSelectJob(G, st, 'director').ok, 'Director gated until all base jobs Lv5');
    ok(!D.levelUpJob(G, st.id, 'director').ok, 'cannot level a gated job');
    /* grant Lv5 base jobs, then Director unlocks */
    ['coder', 'writer', 'designer', 'sound'].forEach(j => st.levels[j] = 5);
    ok(D.canSelectJob(G, st, 'director').ok, 'Director unlocks at Lv5 in four base jobs');
  }

  /* Contracts: success pays cash+data; deadline miss penalises reputation */
  {
    const G = foundState(); G.week = 10;
    const t = D.takeContract(G, 'comic_book');
    ok(t.ok, 'take a contract');
    const cash = G.studio.cash, data = G.gameStudioDesk.researchData;
    let guard = 0; while (G.gameStudioDesk.contracts.length && guard++ < 30) D.tickContracts(G);
    eq(G.gameStudioDesk.contractHistory[0].result, 'success', 'delivered on time');
    ok(G.studio.cash > cash, 'reward paid');
    ok(G.gameStudioDesk.researchData > data, 'research data paid');
  }
  {
    const G = foundState(); G.week = 10; const rep = G.studio.rep;
    D.takeContract(G, 'console_analysis'); /* hardware work, staff has 0 hardware → will miss */
    let guard = 0; while (G.gameStudioDesk.contracts.length && guard++ < 30) D.tickContracts(G);
    eq(G.gameStudioDesk.contractHistory[0].result, 'failed', 'missed deadline');
    ok(G.studio.rep < rep, 'reputation drops on failure');
  }

  /* Merchant: seasonal windows, escalating price, purchase applies effect */
  {
    const G = foundState();
    ok(!D.isMerchantWeek({ week: 1 }), 'no salesman in January');
    ok(D.isMerchantWeek({ week: 18 }), 'salesman visits in May');
    ok(D.isMerchantWeek({ week: 46 }), 'salesman visits in November');
    const p1 = D.itemPrice(G, 'fun_boost');
    G.gameStudioDesk.boostCounts.fun_boost = 1;
    const p2 = D.itemPrice(G, 'fun_boost');
    ok(p2 > p1, 'boost price escalates with purchases');
    G.week = 18; G.gameStudioDesk.researchData = 200;
    D.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu' });
    const funBefore = G.gameStudioDesk.active.fun;
    const buy = D.buyItem(G, 'fun_boost');
    ok(buy.ok, 'buy a Fun Boost');
    ok(G.gameStudioDesk.active.fun > funBefore, 'Fun Boost multiplies Fun');
    const offSeason = D.buyItem({ ...G, week: 1 }, 'fun_boost');
    ok(!offSeason.ok, 'cannot buy outside May/November');
  }

  /* Office tiers + Your Console gating */
  {
    const G = foundState(500);
    ok(!D.expandOffice(G, 3).ok, 'cannot skip to tier 3');
    ok(D.expandOffice(G, 2).ok, 'expand to tier 2');
    ok(D.expandOffice(G, 3).ok, 'expand to tier 3');
    eq(D.directionCapacity(G), 10, 'tier-3 direction capacity = 10');
    ok(!D.buildYourConsole(G, { processor: '64bit' }).ok, 'Your Console blocked without Hardware Engineer');
    G.gameStudioDesk.staff[0].levels.hardware = 1;
    const build = D.buildYourConsole(G, { processor: '64bit', media: 'BD-ROM', form: 'home', name: 'Apex 64' });
    ok(build.ok, 'Your Console builds with tier3 + HW engineer + reserve');
    ok(G.gameStudioDesk.licensed.includes('your_console'), 'Your Console adds a target platform');
  }

  /* Global Game Awards + secret unlocks */
  {
    const G = foundState(500); D._setRng(() => 0.5);
    /* a strong Hall-of-Fame release this year */
    D.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu', directions: { polish: 4 } });
    const p = toDebug(G); p.bugs = 0; p.fun = 90; p.cre = 90; p.gfx = 90; p.snd = 90;
    D.release(G);
    G.week = 50; /* December week 3 */
    const a = D.runAwards(G);
    ok(a.ok, 'awards run with an eligible title');
    ok(a.results.some(r => r.category === 'grand_prize'), 'a Grand Prize is awarded');
    ok(G.gameStudioDesk.awards.length > 0, 'award history recorded');
    ok(G.gameStudioDesk.secrets.mister_x === true, 'Mister X unlocks after a trophy');
  }

  /* July Game Dex: booth tiers, costumes, hype/fans, once-a-year, banked hype */
  {
    const G = foundState(500); D._setRng(() => 0.5);
    G.week = 10; /* out of season */
    ok(!D.isGameDexWeek(G), 'Game Dex closed outside July');
    ok(!D.runGameDex(G, { booth: 'small' }).ok, 'out-of-season Game Dex refused');
    G.week = 28; /* July */
    ok(D.isGameDexWeek(G), 'Game Dex open in July (week 28)');
    const fb0 = { ...G.gameStudioDesk.fanbase };
    const cash0 = G.studio.cash;
    const r = D.runGameDex(G, { booth: 'large', costume: 'mascot' });
    ok(r.ok && r.hype === 28 && r.fans === 45, 'mega booth + mascot yields hype & fans');
    ok(G.gameStudioDesk.dexHype === 28, 'hype banks toward the next greenlight when no active project');
    ok(G.gameStudioDesk.fanbase.young > fb0.young, 'mascot costume grows the young demographic');
    ok(G.studio.cash < cash0, 'booth fee charged');
    ok(!D.runGameDex(G, { booth: 'small' }).ok, 'second Game Dex in the same year refused');
    /* an active project receives the hype directly instead of banking */
    const G2 = foundState(500); D._setRng(() => 0.5); G2.week = 28;
    D.greenlight(G2, { genre: 'action', theme: 'fantasy', platform: 'pc', author: 'gaichu' });
    const hype0 = G2.gameStudioDesk.active.hype;
    const r2 = D.runGameDex(G2, { booth: 'medium', costume: 'idol' });
    ok(r2.ok && G2.gameStudioDesk.active.hype > hype0, 'active project receives Game Dex hype directly');
    ok(G2.gameStudioDesk.fanbase.adult > fb0.adult, 'idol costume skews adult fans');
    /* banked hype is consumed on the next greenlight */
    const banked = G.gameStudioDesk.dexHype;
    const gl = D.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu' });
    ok(gl.ok && G.gameStudioDesk.active.hype >= banked, 'banked hype feeds the greenlit project');
    ok(G.gameStudioDesk.dexHype === 0, 'banked hype resets after greenlight');
  }

  /* Emergency bailout: first injects cash; second cancels the project */
  {
    const G = foundState(500); D._setRng(() => 0.5);
    D.greenlight(G, { genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu' });
    G.studio.cash = -1;
    const first = D.checkBailout(G);
    ok(first.ok && first.bailout, 'first insolvency triggers bailout');
    ok(G.studio.cash >= 0, 'bailout injects cash');
    ok(G.gameStudioDesk.active, 'project survives the first bailout');
    G.studio.cash = -1;
    const second = D.checkBailout(G);
    ok(second.ok && second.cancelled, 'second insolvency cancels project');
    ok(!G.gameStudioDesk.active, 'active project cleared on second insolvency');
  }

  /* 32-title rolling buffer purges #33 and locks purged Hall-of-Fame sequels */
  {
    const G = foundState(100000); D._setRng(() => 0.5);
    for (let i = 0; i < 33; i++) {
      D.greenlight(G, { title: 'Game ' + i, genre: 'rpg', theme: 'fantasy', platform: 'pc', author: 'gaichu' });
      if (G.gameStudioDesk.active) { const p = G.gameStudioDesk.active; p.progress = 100; p.phase = 'debug'; p.bugs = 0; p.fun = p.cre = p.gfx = p.snd = 80; p.franchiseKey = 'fk' + i; }
      D.release(G);
    }
    eq(G.gameStudioDesk.catalog.length, 32, 'catalog capped at 32 titles');
    ok(G.gameStudioDesk.purgedHallOfFame.length >= 1, 'purged Hall-of-Fame franchises recorded');
    const lockedKey = G.gameStudioDesk.purgedHallOfFame[0];
    const seq = D.greenlightSequel(G, '__none__');
    ok(!seq.ok, 'sequel of unknown title refused');
  }
} catch (e) { fail++; console.error('  ✗ ENGINE TEST THREW:', e.stack || e); }

D._resetRng();

/* ══════════════════════ 2. jsdom UI TESTS ══════════════════════ */
const rawIndex = fs.readFileSync('index.html', 'utf8');
const html = rawIndex
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g, (_, file) => '<script>' + fs.readFileSync(file, 'utf8') + '</script>')
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/, '');
const vc = new VirtualConsole(), errors = [];
vc.on('error', (...a) => errors.push(a.join(' ')));
vc.on('jsdomError', e => { if (!/Could not load|Not implemented: (navigation|HTMLCanvasElement|Window's scrollTo)/.test(String(e && e.message))) errors.push(String(e && e.message)); });
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window;
const $ = s => w.document.querySelector(s), $$ = s => [...w.document.querySelectorAll(s)];
const viewText = () => ($('#view') ? $('#view').textContent : '');

w.eval(`
  window.__beeps=[];
  var _origBeep = typeof beep==='function'?beep:function(){};
  beep=function(k){ window.__beeps.push(k); return _origBeep(k); };
`);
const beeps = () => [...w.__beeps];
const clearBeeps = () => { w.__beeps.length = 0; };

function fresh() {
  clearBeeps();
  w.eval(`
    render=function(){_renderImpl()};
    SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};
    newGame(DATA.ARCHETYPES[1].id,'GSD Audit',SEL);
    enterApp(false); closeModal();
    G.studio.cash=500; G.studio.rep=70;
    GAMES_SUB='overview';
    switchTab('games'); render();
  `);
}
function found() { w.eval(`if(typeof foundGameStudio==='function') foundGameStudio(); render();`); }
function lane(key) { w.eval(`document.querySelector('[data-gamessub="${key}"]').click(); render();`); }

/* markers unique to each sub-tab (used to prove no content leakage) */
const MARK = {
  overview: 'Studio signals', develop: 'Plan your next game', catalog: 'Shipped titles',
  studio: 'Legendary characters', contracts: 'Available work', awards: 'Awards history', hardware: 'Your Console'
};

try {
  await new Promise(r => setTimeout(r, 700));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* A1 — one nav strip, no duplicate global chips, no pixel banner */
  fresh();
  eq($('#view').dataset.screen, 'games', 'view is the games screen');
  ok(!!$('.command-games'), 'command-games desk shell present');
  ok(!viewText().includes('STUDIO RECOVERY INTERFACE'), 'no render-boundary crash card');
  eq($$('#view [data-gamessub]').length, 7, 'exactly seven desk nav chips');
  eq($$('#subTabs [data-gamessub]').length, 0, 'no duplicate chips in global #subTabs');
  eq($('#subTabs').style.display, 'none', 'global #subTabs hidden on the desk');
  eq($$('#view .subnav-pills').length, 0, 'legacy .subnav-pills removed');
  eq($$('#view .kairo-dept-banner').length, 0, 'no Kairo pixel banner above the desk');
  eq(new Set($$('#view [data-gamessub]').map(b => b.closest('nav'))).size, 1, 'all chips in one nav');
  eq($$('#view [data-gamessub].active').length, 1, 'exactly one active chip');
  eq($('#view [data-gamessub].active').dataset.gamessub, 'overview', 'fresh career opens Overview');
  ok($('.command-edition') && $('.command-edition').textContent.includes('GAME STUDIO DESK'), 'header branded GAME STUDIO DESK');

  /* A2 — sub-tab switching actually works (the dead-binder bug) and persists */
  fresh(); found();
  clearBeeps();
  lane('develop');
  eq(w.eval('GAMES_SUB'), 'develop', 'clicking a chip updates GAMES_SUB');
  eq(w.eval('G.gameStudioDesk.sub'), 'develop', 'choice persisted to the save object');
  ok(viewText().includes(MARK.develop), 'Development content rendered');
  ok(beeps().includes('click'), 'sub-tab click plays a click SFX (not a silent no-op)');
  w.eval('render();');
  eq($('#view [data-gamessub].active').dataset.gamessub, 'develop', 'choice survives a re-render');
  /* stale value falls back safely */
  w.eval(`G.gameStudioDesk.sub='vault'; render();`);
  eq(w.eval('GAMES_SUB'), 'overview', 'unknown sub falls back to Overview without crashing');

  /* A5 — content is isolated per sub-tab (no old single-page leakage) */
  fresh(); found();
  lane('develop');
  ok(!viewText().includes(MARK.contracts), 'contracts content does not leak into Development');
  ok(!viewText().includes(MARK.awards), 'awards content does not leak into Development');
  lane('catalog');
  ok(!viewText().includes(MARK.develop), 'development CTA does not leak into Catalog');
  ok(!viewText().includes(MARK.contracts), 'contracts content does not leak into Catalog');
  lane('contracts');
  ok(!viewText().includes(MARK.develop), 'development CTA does not leak into Contracts');
  ok(!viewText().includes('Shipped titles'), 'catalog content does not leak into Contracts');

  /* A3/A4 — legacy adaptation: source keys are composite, platform is stored */
  fresh(); found();
  w.eval(`
    G.franchises=[{id:77,name:'Neon Runner',tier:2,decay:0.6,entries:[{ww:200},{ww:220}]}];
    G.films=[]; G.weekTx=G.weekTx||{};
    G.gameStudioDesk.sub='develop'; render();
  `);
  const srcChip = $$('#view [data-gsrc]').find(b => String(b.dataset.gsrc).indexOf('fr:') === 0);
  ok(!!srcChip, 'adaptation source chip uses a composite fr: key');
  if (srcChip) {
    srcChip.click();
    ok(String(w.eval('GAMES.src')).indexOf('fr:') === 0, 'GAMES.src set to the composite key');
    const platBtn = $('#view [data-gplat="pc"]'); if (platBtn) platBtn.click();
    eq(w.eval('GAMES.platform'), 'pc', 'platform target selection recorded');
    const devBtn = $('#view [data-gdev="partner"]'); if (devBtn) devBtn.click();
    const go = $('#gsGo'); if (go) go.click();
    ok(w.eval('G.gamesDiv.projects.length') === 1, 'adaptation project created via #gsGo');
    ok(w.eval('G.gamesDiv.projects[0].platform') === 'pc', 'platform persisted on the project');
    /* release and confirm platform survives to the released record */
    w.eval(`G.gamesDiv.projects[0].weeksLeft=1; G.gamesDiv.projects[0].weekly=1; tickGameStudio();`);
    ok(w.eval('G.gamesDiv.released[0].platform') === 'pc', 'platform persisted through releaseGame');
  }

  /* A5 — BUG FIX: an unaffordable sequel must NOT consume the sequel right.
     (Previously g.isSequel=true was set before the cash check, so the button
     vanished permanently even though no sequel was ever funded.) */
  fresh(); found();
  w.eval(`
    G.gamesDiv.released=[{id:55,title:'Legacy Hit',score:82,platform:'pc',platformName:'PC Game',total:24,earned:24,when:52,weeksLeft:0,weekly:0}];
    G.gamesDiv.projects=[]; GAMES.dev='elite'; G.studio.cash=10;
    G.gameStudioDesk.sub='catalog'; render();
  `);
  const seqBtn = $('#view [data-game-sequel="55"]');
  ok(!!seqBtn, 'legacy sequel button renders for a high-scoring game');
  if (seqBtn) {
    seqBtn.click();
    ok(!w.eval('!!G.gamesDiv.released[0].isSequel'), 'unaffordable sequel leaves the sequel right intact');
    ok(w.eval('G.gamesDiv.projects.length') === 0, 'unaffordable sequel creates no project');
    ok(!!$('#view [data-game-sequel="55"]'), 'unaffordable sequel button still present after retry');
    w.eval('G.studio.cash=500; render();');
    const seqBtn2 = $('#view [data-game-sequel="55"]');
    if (seqBtn2) seqBtn2.click();
    ok(w.eval('G.gamesDiv.released[0].isSequel') === true, 'funded sequel consumes the right');
    ok(w.eval('G.gamesDiv.projects.length') === 1, 'funded sequel creates the project');
  }

  /* A6 — BUG FIX: porting has a real target picker + honest $6M cost label.
     (Previously the button claimed "+$4M" and portGame got no target.) */
  fresh(); found();
  w.eval(`
    G.gamesDiv.released=[{id:66,title:'Port Me',score:52,platform:'pc',platformName:'PC Game',total:20,earned:20,when:52,weeksLeft:0,weekly:0}];
    G.gamesDiv.projects=[]; G.studio.cash=500;
    G.gameStudioDesk.sub='catalog'; render();
  `);
  const portSel = $('#view [data-gport-target="66"]');
  const portBtn = $('#view [data-game-port="66"]');
  ok(!!portSel, 'port target picker renders');
  ok(!!portBtn, 'port button renders');
  ok(portBtn && !/\+\$4M/.test(portBtn.textContent), 'misleading "+$4M" label is gone');
  ok(portBtn && /\$6M/.test(portBtn.textContent), 'port button states the real $6M cost');
  if (portSel && portBtn) {
    portSel.value = 'console';
    portBtn.click();
    ok(w.eval('G.gamesDiv.released[0].ported') === 'console', 'chosen target platform is passed to portGame');
  }

  /* A7 — July Game Dex panel renders, is gated by season, and attending works */
  fresh(); found();
  w.eval(`G.week=10; G.gameStudioDesk.sub='awards'; render();`);
  ok(viewText().includes('JULY GAME DEX'), 'Game Dex panel present on Awards out of season');
  ok(/next in \d+ week/.test(viewText()), 'out-of-season Game Dex shows a countdown');
  ok(!$('#view [data-gs-dex]'), 'no attend button when the convention is closed');
  w.eval(`G.week=28; G.studio.cash=500; render();`);
  const dexBooth = $('#view #gdexBooth'), dexCostume = $('#view #gdexCostume'), dexBtn = $('#view [data-gs-dex]');
  ok(!!dexBooth && !!dexCostume && !!dexBtn, 'Game Dex booth + costume selectors and attend button render in July');
  if (dexBooth && dexCostume && dexBtn) {
    dexBooth.value = 'large'; dexCostume.value = 'idol';
    dexBtn.click();
    ok(w.eval('G.gameStudioDesk.gameDexYear') === w.eval('yearOf(G.week)'), 'attending records the Game Dex year');
    ok(w.eval('G.gameStudioDesk.dexHype') > 0, 'attending banks hype with no active project');
    ok(!$('#view [data-gs-dex]'), 'attend button gone after exhibiting (one booth/year)');
    ok(viewText().includes('Exhibited at Game Dex'), 'done-state confirmation renders');
  }

  /* Zero-legacy-surface sweep across every sub-tab (founded + empty career) */
  for (const setup of ['empty', 'founded']) {
    fresh(); if (setup === 'founded') found();
    for (const key of Object.keys(MARK)) {
      w.eval(`G.gameStudioDesk.sub='${key}'; render();`);
      eq($$('#view .command-games .card').length, 0, `[${setup}/${key}] no legacy .card surface`);
      eq($$('#view .command-games .section-title').length, 0, `[${setup}/${key}] no legacy .section-title`);
      eq($$('#view .command-games .stat-hero').length, 0, `[${setup}/${key}] no legacy .stat-hero`);
      eq($$('#view .command-games .subnav-pills').length, 0, `[${setup}/${key}] no legacy .subnav-pills`);
      ok(!viewText().includes('STUDIO RECOVERY INTERFACE'), `[${setup}/${key}] no render crash`);
    }
  }

  /* No $…MM double-unit strings anywhere on the desk */
  fresh(); found();
  for (const key of Object.keys(MARK)) {
    w.eval(`G.gameStudioDesk.sub='${key}'; render();`);
    ok(!/\$\d[\d.,]*[MB]M/.test(viewText()), `[${key}] no $…MM double-unit label`);
  }

  /* Catalog render is bounded (node-count guard) */
  fresh(); found();
  w.eval(`
    for(let i=0;i<40;i++){ G.gameStudioDesk.catalog.push({id:'g'+i,title:'Bounded '+i,genre:'rpg',theme:'fantasy',platform:'pc',platformName:'PC Game',review:30,judges:[8,8,7,7],tier:'solid',hallOfFame:false,fun:40,cre:40,gfx:40,snd:40,bugs:0,units:500000,revenue:5,milestones:[],salesPlan:[1,1,1,1],weekIndex:4,releasedWeek:1,year:1}); }
    G.gameStudioDesk.sub='catalog'; render();
  `);
  const rows = $$('#view .games-row').length;
  ok(rows <= 25, `catalog render bounded to ≤24 rows (got ${rows})`);
} catch (e) { fail++; console.error('  ✗ UI TEST THREW:', e.stack || e); }

ok(errors.length === 0, 'zero console errors (' + errors.slice(0, 3).join(' | ') + ')');

console.log(`\nGAME STUDIO DESK: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
else console.log('ALL GAME STUDIO DESK CHECKS PASSED [OK]');
