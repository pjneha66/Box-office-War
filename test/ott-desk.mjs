/* OTT desk regressions and feature coverage.
   Runs entirely against the local app shell in jsdom: no network, no save
   fixtures and no simulation writes beyond the explicit action tests. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8')
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>')
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];
vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const ottChips=()=>$$('[data-ottsub]');

try{
  await new Promise(r=>setTimeout(r,900));
  w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'OTT Desk Audit',SEL);enterApp(false);closeModal();switchTab('ott');OTT_SUB='home';render();`);

  /* A1 — the view owns the only OTT navigation. */
  assert.equal(ottChips().length,5,'exactly five OTT chips exist in the whole document');
  assert.equal(new Set(ottChips().map(b=>b.closest('nav')||b.parentElement)).size,1,'all OTT chips belong to one navigation');
  assert.equal($$('#subTabs [data-ottsub]').length,0,'the mobile strip must not duplicate OTT navigation');
  assert.equal(ottChips().filter(b=>b.classList.contains('active')).length,1,'exactly one OTT chip is active');
  console.log('PASS A1: one OTT nav, five chips, one active state');

  /* A2 — navigation leads the reading and Home does not clone Market. */
  const firstSection=$('#view .command-ott > .produce-panel')||$('#view .section-title');
  const nav=ottChips()[0].closest('.subnav-pills')||ottChips()[0].closest('nav');
  assert(firstSection&&nav,'OTT navigation and a body section both render');
  assert(Boolean(nav.compareDocumentPosition(firstSection)&w.Node.DOCUMENT_POSITION_FOLLOWING),'OTT nav appears before the first body section');
  assert(!$('#view').textContent.includes('Streaming market'),'Home must not repeat the Market platform board');
  assert(!$('#view').textContent.includes('The platforms'),'the platform list belongs only to Market');
  const destinations={home:'Your platform',originals:'Your series',deals:'Deal offers',sports:'Live sports rights',market:'The platforms'};
  for(const [key,copy] of Object.entries(destinations)){
    const chip=$(`[data-ottsub="${key}"]`);
    assert(chip,`missing ${key} chip`);
    chip.click();
    assert.equal(w.eval('OTT_SUB'),key,`${key} chip changes sub-tab state`);
    assert($('#view').textContent.includes(copy),`${key} chip switches its panel`);
    assert.equal(ottChips().filter(b=>b.classList.contains('active')).length,1,`${key} leaves one active chip`);
    assert.equal($(`[data-ottsub="${key}"]`).classList.contains('active'),true,`${key} chip owns the active state`);
  }
  $('[data-ottsub="home"]').click();
  console.log('PASS A2: nav leads content, all chips switch panels, Market is not duplicated');

  /* A3 — sports power uses the documented single 1.5% weekly decay. */
  const decay=w.eval(`(function(){
    G.streamer={name:'Decay Test',subs:10,peak:10,sportsPower:10,churn:.008,totalRev:0,lastContent:G.week,tier:'premium',history:[],subHistory:[]};
    G.studio.cash=1000;let min=10;
    for(let i=0;i<10;i++){tickStreamer();min=Math.min(min,G.streamer.sportsPower);}
    return {power:G.streamer.sportsPower,min:min};
  })()`);
  const expected=10*Math.pow(.985,10);
  assert(Math.abs(decay.power-expected)<=.5,`10 ticks at 1.5%/wk should land near ${expected.toFixed(3)}, got ${decay.power}`);
  assert(decay.min>=0,'sports power never goes negative');
  const floor=w.eval(`G.streamer.sportsPower=.0001;for(let i=0;i<200;i++)tickStreamer();G.streamer.sportsPower`);
  assert(floor>=0,'sports power remains clamped at zero');
  console.log('PASS A3: one 1.5%/wk sports decay, non-negative floor');

  /* A4 — expose the two already-implemented streamer actions. */
  w.eval(`G.streamer={name:'Action Test',subs:12.5,peak:12.5,income:6,totalRev:60,sportsPower:2,churn:.008,lastContent:G.week,tier:'premium',crackdown:0,history:[],subHistory:[]};G.studio.cash=500;G.studio.rep=60;OTT_SUB='home';render();window.__crackdownCalls=0;window.__originalCrackdown=crackdownPasswordSharing;crackdownPasswordSharing=function(){window.__crackdownCalls++;return {ok:true,boost:2.5,crackdownWeeks:8};};window.confirm=function(){return true;};`);
  const crackdown=$('#ottCrackdown');
  assert(crackdown,'Home exposes a password-crackdown button');
  assert.equal(typeof crackdown.onclick,'function','password-crackdown button is wired');
  assert.equal(crackdown.disabled,false,'crackdown is available with a streamer and enough cash');
  assert(crackdown.closest('#view').textContent.includes('rep −8'),'crackdown copy discloses the reputation cost');
  assert(crackdown.closest('#view').textContent.includes('churn ×2 for 8 weeks'),'crackdown copy discloses the churn side effect');
  crackdown.click();
  assert.equal(w.eval('window.__crackdownCalls'),1,'the Home button calls crackdownPasswordSharing');
  w.eval(`crackdownPasswordSharing=window.__originalCrackdown;G.streamer.crackdown=3;render();`);
  assert.equal($('#ottCrackdown').disabled,true,'crackdown is disabled while already active');
  w.eval(`OTT_SUB='sports';render();window.__liveEventCalls=[];window.__originalLiveEvent=licenseLiveEvent;licenseLiveEvent=function(type){window.__liveEventCalls.push(type);return {ok:true,ppvRevenue:10,subBoost:1};};`);
  const liveButtons=$$('#view [data-live-event]');
  assert.equal(liveButtons.length,3,'Sports exposes all three existing live-event licenses');
  liveButtons.forEach(b=>assert.equal(typeof b.onclick,'function',`${b.dataset.liveEvent} live-event button is wired`));
  const concert=$('#view [data-live-event="concert"]');
  concert.click();
  assert.equal(w.eval('window.__liveEventCalls.join(",")'),'concert','the live-event button calls licenseLiveEvent with its event type');
  w.eval(`licenseLiveEvent=window.__originalLiveEvent;G.streamer=null;render();`);
  assert($$('#view [data-live-event]').every(b=>b.disabled),'live-event licenses are disabled without a streamer');
  console.log('PASS A4: crackdown and live-event buttons call their engine actions with disabled states');

  /* A5 — legacy dashboard telemetry reads the real nested streamer field. */
  const uiSource=fs.readFileSync('ui.js','utf8');
  assert(!/\bG\.sportsPower\b/.test(uiSource),'UI must not read the non-existent legacy G.sportsPower field');
  w.eval(`G.streamer={name:'Sports Stat',subs:8,peak:8,income:4,totalRev:20,sportsPower:7,churn:.008,lastContent:G.week,tier:'premium',history:[],subHistory:[]};`);
  assert(w.eval('viewStreamerCard()').includes('Sports power'),'legacy dashboard still labels its sports-power stat');
  w.eval(`G.streamer=null;`);
  assert(w.eval('viewStreamerCard()')!==null,'empty streamer dashboard card remains safe');
  console.log('PASS A5: no legacy G.sportsPower reads remain');

  /* B — every reading wears the command shell and none leaks legacy cards. */
  w.eval(`SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'OTT Shell Audit',SEL);enterApp(false);closeModal();switchTab('ott');`);
  for(const key of Object.keys(destinations)){
    w.eval(`OTT_SUB='${key}';render();`);
    assert($('#view .command-ott'),`${key}: command shell missing`);
    assert.equal($$('#view .command-ott > .command-heading').length,1,`${key}: one command header`);
    assert.equal($$('#view .command-ott .command-telemetry .command-metric').length,4,`${key}: four telemetry metrics`);
    assert($$('#view .command-ott > .produce-panel').length>=1,`${key}: produce panels render`);
    assert.equal($$('#view .card').length,0,`${key}: no legacy .card`);
    assert.equal($$('#view .section-title').length,0,`${key}: no legacy .section-title`);
    assert.equal($('#view .cost-line'),null,`${key}: no legacy .cost-line`);
    assert.equal($('#view .kairo-dept-banner'),null,`${key}: Kairo banner is excluded`);
    const ottNav=$('#view .command-ott-nav');
    assert(ottNav,`${key}: branded OTT nav exists`);
    assert.equal($('#view .command-ott > .command-heading').nextElementSibling,ottNav,`${key}: nav sits directly under the header`);
    assert(Boolean(ottNav.compareDocumentPosition($('#view .command-ott > .produce-panel'))&w.Node.DOCUMENT_POSITION_FOLLOWING),`${key}: nav precedes the first panel`);
  }
  console.log('PASS B: command shell, four metrics, nav order and zero legacy OTT markup');

  /* C1–C10 — fresh-game empty states all render before a streamer exists. */
  const freshFeatures={
    home:['.ott-platform','.ott-subscriber-room','.ott-content-health','.ott-eu-quota','.ott-tiers','.ott-crackdown','.ott-rd','.ott-forecast'],
    originals:['.ott-originals'],deals:['.ott-deals'],sports:['.ott-sports','.ott-live-events'],market:['.ott-buyer-fit','.ott-market']
  };
  for(const [key,selectors] of Object.entries(freshFeatures)){
    w.eval(`OTT_SUB='${key}';render();`);
    selectors.forEach(selector=>assert($('#view '+selector),`fresh ${key}: missing ${selector}`));
    assert.equal($$('#view .card, #view .section-title, #view .cost-line').length,0,`fresh ${key}: no legacy markup`);
  }
  w.eval(`OTT_SUB='home';render();`);
  assert.equal($$('#view .ott-tier').length,3,'fresh tiers desk previews all three tiers');
  assert($('#view .ott-subscriber-room .ott-empty'),'fresh subscriber room has an empty state');
  assert($('#view .ott-content-health .ott-empty'),'fresh content health has an empty state');
  assert($('#view .ott-forecast .ott-empty'),'fresh forecast has an empty state');
  assert($('#launchStreamer'),'fresh Home preserves #launchStreamer');
  assert.equal(typeof $('#launchStreamer').onclick,'function','launch button is wired');
  console.log('PASS C1–C10 fresh state: all feature panels and empty states render');

  /* Populate every existing state source used by the desks. */
  w.eval(`G.week=20;G.studio.cash=1000;G.studio.rep=60;
    G.streamer={name:'Desk+',launchedWeek:1,subs:12.5,peak:18.2,income:6.3,totalRev:123.4,sportsPower:8,churn:.008,lastContent:G.week-4,tier:'premium',crackdown:0,euFreeze:3,subHistory:[14,13.5,13,12.5],history:Array.from({length:16},(_,i)=>({w:G.week-15+i,subs:8+i*.3,inc:4+i*.1}))};
    G.films=[
      {id:1,title:'Library One',genre:'drama',budget:40,ww:100,onOwn:true,onOwnPlatform:false,soldTo:'Desk+',streamingOriginal:false,inTheaters:false,location:'london',foreignLang:false,quality:{overall:70}},
      {id:2,title:'Unsold Drama',genre:'drama',budget:40,ww:200,onOwn:false,onOwnPlatform:false,soldTo:null,streamingOriginal:false,inTheaters:false,location:'la',foreignLang:false,quality:{overall:80}},
      {id:3,title:'Foreign Film',genre:'scifi',budget:20,ww:50,onOwn:false,onOwnPlatform:false,soldTo:'StreamFlix',streamingOriginal:false,inTheaters:false,location:'la',foreignLang:true,quality:{overall:65}},
      {id:4,title:'Theater Film',genre:'comedy',budget:30,ww:80,onOwn:false,onOwnPlatform:false,soldTo:null,streamingOriginal:false,inTheaters:true,location:'toronto',foreignLang:false,quality:{overall:60}}
    ];
    G.projects=[{id:301,title:'Prebuy Original',genre:'drama',budget:60,phase:'pre',cast:[]}];
    const season=(num,license,critic,audience,viewership)=>({num,license,critic,audience,viewership,quality:70});
    G.series=[
      {id:101,title:'Shoot Show',genre:'drama',platform:'streamflix',phase:'shoot',status:'active',weeksLeft:3,weeksLeft0:8,budget:48,eps:8,perEp:6,formatId:'docuseries',seasons:[season(1,50,80,70,65)]},
      {id:102,title:'Airing Show',genre:'comedy',platform:'bingebox',phase:'airing',status:'active',airWeeks:2,budget:32,eps:8,perEp:4,formatId:'standard',seasons:[season(1,40,65,60,55)]},
      {id:103,title:'Pending Show',genre:'drama',platform:'prestigemax',phase:'between',status:'renewal_pending',budget:50,eps:6,perEp:8,formatId:'limitedevent',seasons:[season(1,40,60,55,50),season(2,45,70,65,58),season(3,50,80,75,72)]}
    ];
    G.offers=[
      {id:201,type:'film_ott',filmId:2,filmTitle:'Unsold Drama',genre:'drama',platform:'streamflix',value:80,countered:false,expires:G.week+4,biddingWar:true},
      {id:202,type:'prebuy',projectId:301,filmTitle:'Prebuy Original',genre:'drama',platform:'bingebox',value:120,countered:false,expires:G.week+2},
      {id:203,type:'renewal',seriesId:103,seriesTitle:'Pending Show',seasonNum:4,platform:'prestigemax',value:55,budget:50,countered:false,expires:G.week+5}
    ];
    G.sportsWon=['soccer'];G.sportsDeals={soccer:{base:120,subBump:4.5,week:13,bid:130}};G.pendingSports=null;
    G.extraPlatforms=[{id:'newstream',name:'NewStream',color:'#123456',logo:'N',generosity:1.18,renew:55,taste:{drama:1.8},blurb:'Fresh money for prestige.'}];
    G.streamWar=7;G.upgrades={ottrel:true,ottalgo:false,globalcdn:true};OTT_HISTORY_MODE='subs';OTT_SUB='home';render();`);

  /* C1 — recorded history, peak, lifetime revenue, risk and metric toggle. */
  assert($('#view .ott-subscriber-room .bo-chart-svg'),'C1 draws the recorded BOCharts area');
  assert.equal($('#view .ott-chart').dataset.historyCount,'16','C1 uses all 16 recorded points');
  assert.equal($('#view .ott-chart').dataset.chartMode,'subs','C1 starts on subscribers');
  assert($('#view .ott-subscriber-room').textContent.includes('18.2M'),'C1 shows peak subscribers');
  assert($('#view .ott-subscriber-room').textContent.includes('123.4'),'C1 shows lifetime revenue');
  assert($('#view .ott-subscriber-room .ott-risk-high'),'C1 derives a high churn-risk badge');
  assert($('#view .ott-subscriber-room .ott-risk-high').textContent.includes('%'),'C1 risk badge includes percent');
  $$('#view [data-ott-history]').forEach(b=>assert.equal(typeof b.onclick,'function','history toggle is wired'));
  $('#view [data-ott-history="revenue"]').click();
  assert.equal(w.eval('OTT_HISTORY_MODE'),'revenue','revenue toggle changes view state');
  assert.equal($('#view .ott-chart').dataset.chartMode,'revenue','revenue toggle redraws the chart');
  assert($('#view .ott-subscriber-room svg').getAttribute('aria-label').includes('revenue'),'revenue chart has an accessible label');
  $('#view [data-ott-history="subs"]').click();
  console.log('PASS C1: 16-week subscriber/revenue chart, peak, lifetime revenue and churn badge');

  /* C2 / C3 — exact content grace and EU quota rules. */
  assert($('#view .ott-content-health').textContent.includes('15 weeks before churn starts'),'C2 uses the engine strict-greater-than grace boundary');
  assert.equal($$('#view .ott-content-health [data-movestr]').length,1,'C2 only offers a move for the eligible unsold film');
  assert.equal($('#view .ott-content-health [data-movestr]').dataset.movestr,'2','C2 move action targets the real film');
  assert.equal(typeof $('#view .ott-content-health [data-movestr]').onclick,'function','C2 move action is wired');
  assert($('#view .ott-content-health').textContent.includes('MONETIZABLE / UNSOLD'),'C2 labels unsold monetizable films');
  assert($('#view .ott-eu-quota [role="meter"]'),'C3 renders a quota progress meter');
  assert($('#view .ott-eu-quota').textContent.includes('3 wk'),'C3 shows the live euFreeze countdown');
  assert($('#view .ott-eu-quota').textContent.includes('$5.0M'),'C3 shows the configured fine');
  for(const copy of ['LONDON','TORONTO','QUEENSLAND','FOREIGN-LANGUAGE']) assert($('#view .ott-eu-quota').textContent.includes(copy),'C3 eligibility includes '+copy);
  console.log('PASS C2/C3: exact starvation countdown, library moves, EU meter/fine/freeze/eligibility');

  /* C7 / C9 / C10 — tier deltas, research links and pure forecast. */
  assert.equal($$('#view .ott-tier').length,3,'C7 renders three tier cards');
  assert($$('#view .ott-tier .better, #view .ott-tier .worse').length>=3,'C7 compares deltas against the current tier');
  const promo=$('#view [data-tier-card="promo"]');
  assert(promo.textContent.includes('$24M')&&promo.textContent.includes('$60M'),'C7 promo shows both promo and list prices');
  const promoButton=promo.querySelector('[data-tier="promo"]');
  assert(promoButton.textContent.includes('$24M'),'C7 button displays the charged promo rate');
  assert.equal(typeof promoButton.onclick,'function','C7 promo button is wired');
  assert.equal($$('#view [data-ott-upgrade]').length,3,'C9 renders three OTT research chips');
  assert.equal($('#view [data-ott-upgrade="ottrel"]').classList.contains('owned'),true,'C9 marks ottrel owned');
  assert.equal($('#view [data-ott-upgrade="ottalgo"]').classList.contains('owned'),false,'C9 marks ottalgo unowned');
  assert($('#view [data-ott-upgrade="ottalgo"]').textContent.includes('×1.15')&&$('#view [data-ott-upgrade="ottalgo"]').textContent.includes('−20%'),'C9 names exact ceiling/churn effects');
  assert($('#view [data-ott-upgrade="globalcdn"]').textContent.includes('×1.18'),'C9 names exact offer effect');
  assert.equal(typeof $('#ottOpenRd').onclick,'function','C9 R&D cross-link is wired');
  const streamerBefore=w.eval('JSON.stringify(G.streamer)');
  const projected=w.eval('ottSubscriberForecast(12)');
  assert.equal(projected.rows.length,12,'C10 projects exactly 12 weeks');
  w.eval('render();');
  assert.equal(w.eval('JSON.stringify(G.streamer)'),streamerBefore,'C10 forecast and render never mutate the save');
  assert($('#view .ott-forecast').textContent.includes('ESTIMATE'),'C10 is labelled an estimate');
  assert($('#view .ott-forecast').textContent.includes('Assumptions'),'C10 prints its assumption line');
  assert($('#view .ott-forecast-hero').textContent.includes(w.eval('fmtSubs('+projected.rows[11].subs+')')),'C10 prints the projected subscriber number');
  assert($('[data-rebrand-streamer]'),'Home preserves the rebrand action');
  assert.equal(typeof $('[data-rebrand-streamer]').onclick,'function','rebrand action is wired');
  console.log('PASS C7/C9/C10: tier deltas/pricing, R&D effects/link and read-only 12-week forecast');

  /* Verify the displayed promo charge through the existing engine action. */
  w.eval(`G.studio.cash=100;G.streamer.tier='premium';OTT_SUB='home';render();`);
  const cashBefore=w.eval('G.studio.cash');
  $('#view [data-tier="promo"]').click();
  assert.equal(w.eval('G.streamer.tier'),'promo','promo button switches tier');
  assert.equal(cashBefore-w.eval('G.studio.cash'),24,'promo button charges exactly the displayed $24M');
  w.eval(`G.studio.cash=1000;G.streamer.tier='premium';render();`);

  /* C6 — production pipeline, renewal countdown, format and season history. */
  w.eval(`OTT_SUB='originals';render();`);
  assert.equal($$('#view .ott-series').length,3,'C6 renders every series');
  assert($('#view [data-series-id="101"]').textContent.includes('3 weeks left'),'C6 shoot countdown renders');
  assert($('#view [data-series-id="101"]').textContent.includes('/wk'),'C6 shoot burn renders');
  assert($('#view [data-series-id="102"]').textContent.includes('2 weeks left'),'C6 airing countdown renders');
  assert($('#view [data-series-id="103"]').textContent.includes('5 weeks to answer'),'C6 renewal countdown comes from its offer');
  assert.equal($$('#view [data-series-id="103"] .ott-data-row').length,3,'C6 shows the last three seasons');
  assert($('#view [data-series-id="103"]').textContent.includes('license')&&$('#view [data-series-id="103"]').textContent.includes('crit')&&$('#view [data-series-id="103"]').textContent.includes('aud'),'C6 season rows include license/critic/audience');
  assert.equal($$('#view .ott-format').length,3,'C6 gives every series a format chip');
  assert($('#view [data-series-id="101"]').textContent.includes('Prestige Docuseries'),'C6 format comes from DATA.SERIES_FORMATS');
  for(const selector of ['[data-rename]','[data-cancel-series]','[data-spinoff-series]']) $$(`#view ${selector}`).forEach(b=>assert.equal(typeof b.onclick,'function',selector+' remains wired'));
  assert.equal($$('#view [data-spinoff-series]').length,1,'C6 preserves film continuation when eligible');
  console.log('PASS C6: series pipeline, renewal countdown, last-three seasons, formats and actions');

  /* C5 — sorted, comparable, expiring offer cards. */
  w.eval(`OTT_SUB='deals';render();`);
  assert.equal($$('#view .ott-offer').map(x=>x.dataset.offerId).join(','),'202,201,203','C5 sorts offers by value');
  assert($('#view [data-offer-id="202"]').textContent.includes('2.00× budget'),'C5 pre-buy compares value with project budget');
  assert($('#view [data-offer-id="201"]').textContent.includes('2.00× budget'),'C5 film license compares value with film budget');
  assert($('#view [data-offer-id="203"]').textContent.includes('1.10× budget'),'C5 season order compares value with season budget');
  assert($('#view [data-offer-id="201"]').textContent.includes('BIDDING WAR'),'C5 bidding-war flag renders');
  assert($('#view [data-offer-id="202"]').textContent.includes('expires in 2 wk'),'C5 expiry countdown renders');
  assert.equal($$('#view [data-acc]').length,3,'C5 preserves accept on every offer');
  $$('#view [data-acc]').forEach(b=>assert.equal(typeof b.onclick,'function','C5 accept action is wired'));
  console.log('PASS C5: value-sorted offers, budget multiples, expiry, bidding war and accept');

  /* C8 — auction timing and sportEcon rights economics. */
  w.eval(`OTT_SUB='sports';render();`);
  assert($('#view .ott-auction-countdown').textContent.includes('Week 26'),'C8 identifies the next quarterly auction');
  assert($('#view .ott-auction-countdown').textContent.includes('6 weeks'),'C8 computes the auction countdown');
  assert($('#view [data-sport-id="soccer"]').textContent.includes('39 weeks'),'C8 uses sportEcon duration');
  assert($('#view [data-sport-id="soccer"]').textContent.includes('20M'),'C8 uses sportEcon viewers');
  assert($('#view [data-sport-id="soccer"]').textContent.includes('Ads / week'),'C8 shows weekly ads');
  assert($('#view .ott-sports-power').textContent.includes('~1.5%/wk'),'C8 shows the corrected decay rate');
  console.log('PASS C8: auction countdown, held-rights economics and corrected decay');

  /* C4 — complete buyer × taste table, entrant and streaming-war state. */
  w.eval(`OTT_SUB='market';render();`);
  const buyerCount=w.eval('DATA.allPlatforms().length'), genreCount=w.eval('Object.keys(DATA.GENRES).length');
  assert.equal($$('#view .ott-buyer-table tbody tr').length,buyerCount,'C4 includes every platform and entrant');
  assert.equal($$('#view .ott-taste').length,buyerCount*genreCount,'C4 includes every taste multiplier');
  assert.equal($$('#view .ott-buyer-table tbody tr')[0].dataset.buyerId,'newstream','C4 sorts for the studio strongest genre');
  assert($('#view .ott-buyer-fit').textContent.includes('Drama'),'C4 names the strongest genre');
  assert($('#view [data-buyer-id="newstream"]').textContent.includes('NEW ENTRANT'),'C4 badges extraPlatforms entrants');
  assert($('#view .ott-war-banner').textContent.includes('+30%')&&$('#view .ott-war-banner').textContent.includes('7 weeks left'),'C4 shows streaming-war offer lift and weeks left');
  assert($('#view .ott-market').textContent.includes('The platforms'),'Market retains The platforms string');
  console.log('PASS C4: full buyer-fit table, strongest-genre sort, entrants and streamWar banner');

  /* Offline re-render of every populated reading; all scripts are already local. */
  w.eval(`Object.defineProperty(navigator,'onLine',{configurable:true,get:function(){return false;}});dispatchEvent(new Event('offline'));`);
  for(const [key,selectors] of Object.entries(freshFeatures)){
    w.eval(`OTT_SUB='${key}';render();`);
    selectors.forEach(selector=>assert($('#view '+selector),`offline ${key}: missing ${selector}`));
    assert.equal(ottChips().length,5,`offline ${key}: one five-chip nav remains`);
    assert.equal($$('#view .card, #view .section-title, #view .cost-line').length,0,`offline ${key}: no legacy markup`);
  }
  console.log('PASS C1–C10 offline: all five populated sub-tabs re-render without network');

  /* Empty-state variants must not throw or strand old cards. */
  w.eval(`G.offers=[];OTT_SUB='deals';render();`);
  assert($('#view .ott-deals .ott-empty'),'empty offers state renders');
  w.eval(`G.series=[];OTT_SUB='originals';render();`);
  assert($('#view .ott-originals .ott-empty').textContent.includes('Develop'),'empty originals points at Develop');
  w.eval(`G.sportsWon=[];OTT_SUB='sports';render();`);
  assert($('#view .ott-sports .ott-empty'),'empty held-rights state renders');
  w.eval(`G.streamer=null;OTT_SUB='home';render();`);
  assert($('#view .ott-subscriber-room .ott-empty')&&$('#view .ott-forecast .ott-empty'),'no-streamer Home empty states render');
  console.log('PASS empty states: offers, originals, sports and no-streamer analytics');

  /* Release plumbing moves as one versioned unit. Read the release identifier
     from version.json so a routine version bump does not leave stale tests. */
  const release=JSON.parse(fs.readFileSync('version.json','utf8')).v;
  assert.equal($('meta[name="app-version"]').content,release,'app-version matches version.json');
  const rawIndex=fs.readFileSync('index.html','utf8');
  assert(rawIndex.includes(`ui.js?v=${release}`)&&rawIndex.includes(`command-deck.css?v=${release}`),'UI and deck assets use the current release version');
  assert(!rawIndex.includes('50.9'),'old asset version is gone');
  assert(fs.readFileSync('sw.js','utf8').includes('bow-v102-cache'),'service-worker cache is bow-v102');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='38.0').status`),'shipped','38.0 Treasury Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='37.0').status`),'shipped','37.0 Game Studio Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='34.7').status`),'shipped','34.7 streamer sub-tabs are marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='34.9').status`),'shipped','34.9 Live Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='35.0').status`),'shipped','35.0 Empire Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='36.0').status`),'shipped','36.0 Library Desk is marked shipped');
  assert.equal(w.eval(`NEXT_UPDATES.find(x=>x.version==='34.8').status`),'planned','34.8 board verdicts are queued next');
  assert(w.eval(`NEXT_UPDATES.find(x=>x.version==='34.8').label`).includes('§45'),'34.8 names the real board-verdicts item');
  console.log(`PASS release: ${release} / bow-v102 and roadmap statuses`);

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('OTT DESK PASSED ✅');
}catch(e){
  console.error('OTT DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
