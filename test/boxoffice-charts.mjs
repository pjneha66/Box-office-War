/* Box office figures — the chart kit and every surface that now uses it.
   Guards the redesign of the run card, the three run folds, the reviews
   dialog, the film dossier, the territories chart and the module panels
   (blitz / PLF / chains / awards) that used to ship legacy card stacks. */
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

await new Promise(r=>setTimeout(r,900));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Figures Audit',SEL);enterApp(false);closeModal();`);

/* 1 — the chart kit itself, independent of the desk */
const kit=w.eval(`(function(){
  const P=[{label:'W1',value:34.3},{label:'W2',value:13.4},{label:'W3',value:8.1}];
  const a=BOCharts.area(P,{aria:'test'});
  const b=BOCharts.bars(P,{});
  const s=BOCharts.split([{label:'Dom',value:47.8},{label:'Intl',value:25.7,tone:'teal'}]);
  return {hasArea:a.indexOf('<svg')===0,hasPolyline:a.indexOf('<polyline')>0,ticks:(a.match(/<text/g)||[]).length,
          hasBars:b.indexOf('<svg')===0,bars:(b.match(/<rect/g)||[]).length,
          hasSplit:s.indexOf('bo-split')>0,segs:(s.match(/bo-split-seg/g)||[]).length,
          money:[BOCharts.money(34.3),BOCharts.money(73.5),BOCharts.money(0.6)]};
})()`);
assert.equal(kit.hasArea,true,'area() returns an svg');
assert.equal(kit.hasPolyline,true,'area() draws the gross curve');
assert(kit.ticks>=8,'area() labels four gridlines and the weeks');
assert.equal(kit.hasBars,true,'bars() returns an svg');
assert.equal(kit.bars,3,'bars() draws one bar per point');
assert.equal(kit.hasSplit,true,'split() returns the meter');
assert.equal(kit.segs,2,'split() draws one segment per part');
assert.equal(JSON.stringify(kit.money),JSON.stringify(['$34.3M','$73.5M','$600K']),'money() speaks the desk grammar');
console.log('PASS chart kit: area, bars, split, money formatting');

/* 2 — a live run renders the new card, not the legacy stack */
w.eval(`G.films.push({id:9001,title:'Every Berlin',genre:'drama',scale:'mid',budget:40,marketing:40,
  dom:47.8,intl:25.7,ww:73.5,opening:34.3,weeksOut:2,releaseWeek:G.week-2,inTheaters:true,
  quality:{overall:88,critic:97,aud:99},criticAvg:97,freshPct:100,rating:'PG-13',rentalsDom:25.3,premium:true,
  weekly:[{w:G.week-2,gross:34.3},{w:G.week-1,gross:13.4}],
  cast:[{name:'Dante Brooks',power:4}],director:{name:'Mira Vasquez'},writer:{name:'Jonah Fell'},producer:{name:'Ava Lind'},
  social:{hype:9,memes:1,theories:1,controversy:0},
  regions:[{id:'europe',name:'Europe',emoji:'🇪🇺',gross:7.3,share:10,aud:95},
           {id:'eastasia',name:'East Asia',emoji:'🌏',gross:5.1,share:7,aud:95},
           {id:'india',name:'India',emoji:'🇮🇳',gross:2.9,share:4,aud:95}],
  reviews:[{name:'Cinema Quarterly',outlet:'Print',score:92,sentiment:'positive',quote:'A patient, gorgeous film.',cats:{story:9,direction:10,acting:9,production:9,entertainment:8,originality:10}},
           {name:'Variety Chronicle',outlet:'Trade',score:50,sentiment:'mixed',quote:'Handsome but chilly.',cats:{story:5,direction:6,acting:6,production:7,entertainment:4,originality:5}}],
  gdsJudges:[{name:'Cinema Quarterly',focus:'Direction & Craft',score:9},{name:'Variety Chronicle',focus:'Star Power & Scale',score:5},{name:'Popcorn Express',focus:'Audience Entertainment',score:9},{name:'Indie Wirehouse',focus:'Screenplay & Vision',score:9}],
  gdsTotal:32,year:yearOf(G.week)});
  BOXOFFICE_SUB='chart';switchTab('boxoffice');`);

assert($('.bo-run'),'the run renders a card');
assert.equal($$('.bo-run .bo-chart-svg').length>=1,true,'the run draws a real weekly chart');
assert.equal($$('.bo-run .bo-kpi').length,6,'six live KPIs on the run');
assert($('.bo-run .bo-split'),'domestic/international split meter');
assert.equal($$('.bo-run-figures .bo-legend-item').length,2,'the split figure names both sides');
assert($('.bo-run .bo-run-head h3').textContent.includes('Every Berlin'));
assert($('.bo-run .bo-run-stamp'),'run health stamp');
assert.equal($$('.bo-run .stat').length,0,'legacy stat tiles are gone');
assert.equal($$('.bo-run .cost-line').length,0,'legacy cost lines are gone inside the run');
assert.equal($$('.bo-run .card').length,0,'legacy cards are gone inside the run');
assert.equal($$('.bo-run [data-reviews]').length,1,'reviews entry point preserved');
assert.equal($$('.bo-run [data-dossier]').length,1,'dossier entry point preserved');
console.log('PASS run card: chart, KPIs, split meter, preserved bindings');

/* 3 — the six folds and their bodies */
const foldIds=['daily:9001','weeks:9001','why:9001','regions:9001','demo:9001','social:9001'];
foldIds.forEach(id=>assert($(`.bo-run [data-fold="${id}"]`),'fold missing: '+id));
w.eval(`BOXOFFICE_SUB='chart';render();`);
$$('.bo-run .fold-head').forEach(h=>{ h.click(); });
assert($('.bo-run .bo-weeks'),'week-by-week ledger');
assert.equal($$('.bo-run .bo-weeks-row').length,2,'one ledger row per reported week');
assert.equal($$('.bo-run .bo-why-row').length>=4,true,'why-desk insight rows');
assert.equal($$('.bo-run .bo-why-mark').length,$$('.bo-run .bo-why-row').length,'every insight carries a direction mark');
assert.equal($$('.bo-run .bo-track-row').length>=5,true,'region + demographic tracks');
assert($('.bo-run .bo-region-cities'),'city detail under the top markets');
assert($('.bo-run .bo-daily svg, .bo-run svg'),'daily bars render');
assert.equal($$('.bo-run .bo-track.teal').length>=3,true,'regional tracks use the teal scale');
assert($('.bo-run .bo-chip'),'social signals render as chips');
console.log('PASS run folds: ledger, why desk, regions, demographics, social');

/* 4 — reviews dialog in the produce shell */
w.eval(`reviewsModal(9001);`);
assert($('#modalRoot .command-produce-modal'),'reviews opens the produce shell');
assert($('#modalRoot .produce-modal-head h3').textContent.includes('Every Berlin'));
assert.equal($$('#modalRoot .bo-score-card').length,3,'critics, audience, fresh');
assert($('#modalRoot .bo-split'),'score distribution meter');
assert.equal($$('#modalRoot .produce-modal-card').length>=5,true,'critic desk, distribution, live ops and both reviews');
['revLiveTiktok','revLiveMidnight','revLiveBlitz','revLiveLeak'].forEach(id=>assert($('#'+id),'live ops button missing: '+id));
assert.equal($$('#modalRoot .bo-review-quote').length,2,'review quotes are pulled out');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the reviews dialog');
w.eval(`closeModal();`);
console.log('PASS reviews dialog: produce shell, live-ops IDs, score meters');

/* 5 — film dossier */
w.eval(`openFilmDetailsModal(9001);`);
assert($('#modalRoot .command-produce-modal'),'dossier opens the produce shell');
assert.equal($$('#modalRoot .bo-kpi').length,8,'eight financial tiles');
assert($('#modalRoot .bo-split'),'revenue split figure');
assert.equal($$('#modalRoot .bo-track-row').length>=7,true,'territories and creative rows');
assert($('#dossierTerritoryDeals'),'territory deals action preserved');
assert($('#modalRoot .produce-modal-actions'),'dossier footer actions');
assert.equal($$('#modalRoot .territory-grid').length,0,'legacy territory grid gone');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the dossier');
w.eval(`closeModal();`);
console.log('PASS dossier: KPIs, split, territories, actions');

/* 6 — every reading is free of legacy cards, and territories draws a chart */
const readings=['chart','chains','plf','blitz','territories','awards','clash'];
for(const key of readings){
  w.eval(`BOXOFFICE_SUB='${key}';render();`);
  assert($('.command-boxoffice'),key+': shell missing');
  assert.equal($$('#view .section-title').length,0,key+': legacy section title leaked');
  assert.equal($$('#view .cost-line').length,0,key+': legacy cost line leaked');
  assert.equal($$('#view .card').length,0,key+': legacy card leaked');
}
w.eval(`BOXOFFICE_SUB='territories';render();`);
assert.equal($$('.command-boxoffice .bo-chart-svg').length,1,'territories draws the market chart');
assert.equal($$('.command-boxoffice .bo-kpi').length,4,'territories summary tiles');
w.eval(`BOXOFFICE_SUB='blitz';render();`);
assert.equal($$('.command-boxoffice .bo-campaign').length,5,'five blitz campaigns');
assert($('#btnOpenMarketingBlitzModal'),'blitz command shortcut preserved');
w.eval(`BOXOFFICE_SUB='chains';render();`);
assert.equal($$('.command-boxoffice .bo-chain-card').length>=5,true,'circuit cards');
w.eval(`BOXOFFICE_SUB='plf';render();`);
assert.equal($$('.command-boxoffice .bo-campaign').length>=3,true,'PLF format cards');
w.eval(`BOXOFFICE_SUB='awards';render();`);
assert.equal($$('.command-boxoffice .bo-campaign').length>=4,true,'award circuit cards');
console.log('PASS all seven readings: no legacy cards, charts and module panels intact');

/* 7 — the dialogs that open from this desk are all produce shells */
w.eval(`rivalProfileModal(G.rivals[0]);`);
assert($('#modalRoot .command-produce-modal'),'rival dossier opens the produce shell');
assert($('#modalRoot .produce-modal-head h3').textContent.includes(w.eval('G.rivals[0].name')),'rival name in the head');
assert.equal($$('#modalRoot .bo-kpi').length,4,'rival KPI strip');
assert($('#modalRoot .bo-split'),'head-to-head split');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the rival dossier');
w.eval(`closeModal();`);

w.eval(`G.news=G.news||[];G.news.push({w:G.week,t:'Praise for the new slate.'});WKSNAP={cash:G.studio.cash-4.8,weeks:1};try{localStorage.setItem('bow_wksum','1')}catch(e){};weekSummaryModal();`);
assert($('#modalRoot .command-produce-modal'),'weekly report opens the produce shell');
assert($('#modalRoot .produce-modal-head'),'weekly report head with the cash delta');
assert.equal($$('#modalRoot .bo-track-row').length>=1,true,'weekly report lists the week facts');
assert($('#modalRoot #wkGo'),'Onward button preserved');
assert.equal($$('#modalRoot [data-wk-tab]').length,4,'all four jump buttons preserved');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the weekly report');
w.eval(`closeModal();`);

w.eval(`MarketingBlitz.openMarketingBlitzModal(G);`);
assert($('#modalRoot .command-produce-modal'),'blitz command opens the produce shell');
assert($('#modalRoot #mktgModalInner'),'re-render hook preserved');
assert($('#modalRoot .produce-modal-head h3').textContent.toLowerCase().includes('marketing blitz'),'blitz head');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the blitz command');
w.eval(`closeModal();`);
console.log('PASS dialogs: rival dossier, weekly report and blitz command are produce shells');

/* 8 — every remaining dialog inherits the produce chrome instead of the old
   navy surface, and the converted decision dialogs keep their bindings */
w.eval(`switchTab('boxoffice');achievementsModal();`);
const legacyClass=w.eval(`document.querySelector('#modalRoot .modal').className`);
assert(legacyClass.includes('command-legacy-modal'),'legacy dialogs get the produce chrome');
assert(!/rgb\(2[0-9], 3[0-9]/.test(w.eval(`getComputedStyle(document.querySelector('#modalRoot .modal')).backgroundColor`)),'no navy surface');
w.eval(`closeModal();`);

w.eval(`G.pendingChoice={icon:'📣',title:'Casting controversy',text:'Casting Thyago Greene has the internet divided.',choices:[{label:'Defend it',i:0},{label:'Back down',i:1}]};choiceModal();`);
assert($('#modalRoot .command-produce-modal'),'decision dialog is a produce shell');
assert.equal($$('#modalRoot [data-ch]').length,2,'both choices stay bound');
assert.equal($$('#modalRoot .card').length,0,'no legacy cards in the decision dialog');
w.eval(`closeModal();`);

w.eval(`G.pendingReport={year:1,myWW:210,filmsReleased:3,profit:18,standings:[{name:'Apex Pictures',ww:530,me:false},{name:'Lighthouse',ww:210,me:true}],awards:{noms:[{title:'Every Berlin',mine:true}],wins:[{cat:'Best Picture',film:'Every Berlin',mine:true}]}};reportModal();`);
assert($('#modalRoot .command-produce-modal'),'year report is a produce shell');
assert.equal($$('#modalRoot .bo-kpi').length,4,'year report KPI strip');
assert.equal($$('#modalRoot .bo-track-row').length>=3,true,'market share + awards rows');
assert($('#modalRoot #reportGo'),'roll credits action preserved');
w.eval(`closeModal();`);

w.eval(`G.compareSel=[9001,9002];G.films.push({id:9002,title:'Stellar Signal',genre:'sci',ww:210,dom:120,intl:90,opening:78,budget:120,marketing:60,quality:{overall:74,critic:70,aud:78},criticAvg:70,releaseWeek:G.week-8,year:yearOf(G.week)});compareFilmsModal();`);
assert($('#modalRoot .command-produce-modal'),'comparison is a produce shell');
assert.equal($$('#modalRoot .bo-compare-card').length,2,'one card per selected film');
assert($('#modalRoot .bo-chart-svg'),'comparison draws a shared scale chart');
assert($('#modalRoot #compareClose'),'close action preserved');
w.eval(`closeModal();`);
console.log('PASS shared chrome: legacy dialogs, decisions, year report, comparison');

assert.deepEqual(errors,[]);
console.log('BOX OFFICE FIGURES PASSED ✅');
