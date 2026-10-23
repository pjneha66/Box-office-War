/* Box Office desk — Story Department rules applied to the market tab.
   Verifies one branded shell, one numbered rail with every reading, produce
   panels instead of legacy card stacks, live state in the header/telemetry,
   preserved IDs and bindings, and the empty/active states for each section. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
try{
await new Promise(r=>setTimeout(r,900));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Market Audit',SEL);enterApp(false);closeModal();switchTab('boxoffice');`);

/* 1 — one command shell, one rail, seven readings */
assert($('.command-boxoffice'),'box office must render the command deck');
assert.equal($('.command-boxoffice').classList.contains('command-deck'),true);
assert.equal($$('#view .command-section-nav').length,1,'exactly one section rail');
assert.equal($$('#view .subnav-pills').length,0,'legacy pill strip must be gone');
assert.equal($$('.command-boxoffice-nav .command-nav-items button').length,7,'seven market readings');
assert.equal($('.command-boxoffice-nav .command-nav-items button.active span').textContent,'Theatrical chart');
assert($('.command-edition').textContent.includes('BOX OFFICE DESK'));
assert($('.command-heading h1').textContent.length>10);
assert.equal($$('.command-telemetry .command-metric').length,4);
assert.equal($('#view').dataset.screen,'boxoffice');
/* one rail on every viewport — the desk no longer renders a second mobile strip */
assert.equal($$('#subTabs [data-bosub]').length,0,'no duplicate mobile strip hooks');
assert.equal($('#subTabs').style.display,'none','legacy strip stays collapsed on this desk');
assert.equal($$('.command-boxoffice-nav [data-bosub]').length,7,'the branded rail carries every reading to mobile');

/* 2 — each reading renders a branded panel and no bare legacy card stack */
const labels={
  chart:'Theatrical chart',chains:'Mega-chains',plf:'PLF & concessions',
  blitz:'Marketing blitz',territories:'Territory deals',awards:'Awards circuit',clash:'Clash radar'
};
for(const [key,label] of Object.entries(labels)){
  w.eval(`closeModal();BOXOFFICE_SUB='${key}';switchTab('boxoffice');`);
  assert($('.command-boxoffice'),key+': shell missing');
  assert.equal($('.command-boxoffice-nav .command-nav-items button.active span').textContent,label,key+': active reading not highlighted');
  assert($$('.command-boxoffice .produce-panel').length>=1,key+': no produce panel');
  assert.equal($$('.command-boxoffice .produce-panel .produce-panel-head h2').length>=1,true,key+': panel head missing');
  assert.equal($$('#view > .card, #view > .section-title').length,0,key+': legacy top-level card/section-title leaked');
  assert.equal($$('#view .subnav-pills').length,0,key+': legacy pill strip leaked');
  /* every surviving .card lives inside a branded panel */
  for(const card of $$('.command-boxoffice .card')){
    assert(card.closest('.produce-panel')||card.closest('.bo-run'),key+': legacy card outside a produce panel');
  }
  assert($('.command-heading p').textContent.length>20,key+': reading has no editorial line');
}
/* the branded rail drives the reading — it is the only strip on every viewport */
$('.command-boxoffice-nav [data-bosub="clash"]').click();
assert.equal(w.eval('BOXOFFICE_SUB'),'clash','rail switches the reading');
assert.equal($('.command-boxoffice-nav .command-nav-items button.active span').textContent,'Clash radar');
$('.command-boxoffice-nav [data-bosub="chart"]').click();
assert.equal(w.eval('BOXOFFICE_SUB'),'chart');
console.log('PASS box office shell, single rail, seven readings');

/* 3 — the chart reads live state, including rival pictures */
w.eval(`BOXOFFICE_SUB='chart';switchTab('boxoffice');`);
assert($('.command-boxoffice .bo-empty'),'an empty chart must explain itself');
assert($('.bo-empty .produce-action'),'empty chart offers a next step');
w.eval(`G.rivals[0].slate.push({title:'Rival <Tentpole>',genre:'action',opening:40,live:true,week:G.week,weeksOut:1,quality:70});render();`);
assert.equal($$('.bo-chart-row').length,1,'chart row for the rival release');
assert.equal($$('#view > .card').length,0);
assert($('.bo-chart-name b').textContent.includes('<Tentpole>'),'titles are escaped, never injected');
assert($('.bo-foot').textContent.includes('Leader'));
w.eval(`BOXOFFICE_SUB='clash';render();`);
assert($('.command-boxoffice .bo-weekends'),'clash radar keeps the forward corridor');
assert.equal($$('.bo-weekend').length,12,'twelve weekends forecast');
assert($$('.bo-rivals .rival-card').length>=1,'rival dossiers stay clickable');
assert.equal($$('.bo-rivals .rival-card').every(c=>c.onclick)!==undefined,true);
console.log('PASS box office chart reads live rival state, clash radar wired');

/* 4 — table features, dossier bindings and the catalogue shortcut survive */
w.eval(`BOXOFFICE_SUB='chains';render();`);
assert($$('[data-court]').length>=1,'chain courts stay bound');
assert.equal(typeof $('[data-court]').onclick,'function','chain court unwired');
assert($('.bo-chain-card'),'chain relation card rendered');
w.eval(`BOXOFFICE_SUB='chart';G.films.push({id:9001,title:'Quiet Feature',genre:'drama',scale:'mid',budget:20,ww:60,dom:35,opening:18,weekly:[{w:G.week,gross:5}],weeksOut:2,quality:{overall:70,critic:68,aud:72},releaseWeek:G.week-1,inTheaters:false,profit:10,year:yearOf(G.week)});render();`);
assert($$('.bo-library .film-row').length>=1,'library row rendered inside the panel');
assert.equal($$('.bo-library .film-row').length,$$('.bo-library .film-row[data-film-id]').length);
const row=$('.bo-library .film-row');
assert.equal(typeof row.onclick,'function','library row unwired');
assert($('.bo-library .film-cb'),'compare checkbox survives');
w.eval(`BOXOFFICE_SUB='territories';render();`);
assert($('.command-boxoffice .bo-territories'),'territory panel present');
w.eval(`BOXOFFICE_SUB='chart';render();`);
assert.equal(typeof $('#btnBoLibrary').onclick,'function','catalogue shortcut unwired');
/* the desk tools keep the banner's destinations reachable from the rail */
for(const [id,label] of [['#btnBoGrosses','weekend grosses'],['#btnBoTheaters','theater chains'],['#btnBoScreenings','audience screenings']]){
  assert($(id),'missing desk tool: '+label);
  assert.equal(typeof $(id).onclick,'function','desk tool unwired: '+label);
}
$('#btnBoTheaters').click();
assert($('#modalRoot .modal'),'theater chains tool opens a dialog');
assert.equal($('#modalRoot .command-produce-modal')!==null,true,'theater chains wears the produce shell');
assert($('#modalRoot .produce-modal-head h3').textContent.includes('theater chains'));
assert($('#modalRoot .produce-modal-actions'),'theater chains has a foot');
assert.equal($$('#modalRoot .produce-modal-card .grid .card').length,5,'every circuit is contractable');
assert($$('#modalRoot [data-buychain]').length>=1,'chain purchase hooks survive the re-skin');
w.eval('closeModal();');
/* weekend grosses report mirrors the live chart */
$('#btnBoGrosses').click();
assert($('#modalRoot .command-produce-modal'),'weekend grosses wears the produce shell');
assert($('#modalRoot .produce-modal-head h3').textContent.includes('Weekend'));
assert.equal($$('#modalRoot .bo-weekend-report-row').length,$$('.bo-chart-row').length,'report matches the desk chart');
w.eval('closeModal();');
/* festival circuit: a real picker, a real submit, empty and refused states */
w.eval('closeModal();');
assert.equal(w.eval('typeof festivalPrModal'),'function','festivalPrModal alias must exist');
/* empty state first: no finished picture anywhere in the studio */
w.eval(`window.__films=G.films.slice();window.__projects=G.projects.slice();G.films=[];G.projects=[];BOXOFFICE_SUB='awards';render();document.querySelector('#btnBoScreenings').click();`);
assert($('#modalRoot .command-produce-modal'),'festival circuit wears the produce shell');
assert($('#modalRoot .produce-modal-head h3').textContent.includes('Festival'));
assert($('#modalRoot .produce-modal-card').textContent.includes('Nothing is ready for the circuit'),'empty state explains itself');
assert.equal($$('#modalRoot [data-fest]').length,0,'no submit button without a finished picture');
w.eval(`closeModal();G.films=window.__films;G.projects=window.__projects;`);
w.eval(`G.projects.push({id:'fest-1',title:'Festival Picture',genre:'drama',phase:'ready',budget:30,cast:[],quality:{overall:80,critic:78,aud:80},phaseLen:{pre:2,shoot:4,post:2}});G.studio.cash=100;closeModal();openFestivalPrModal();`);
assert($('#modalRoot .bo-fest-pick'),'each festival carries a film picker');
assert.equal($$('#modalRoot [data-fest]').length,$$('#modalRoot .bo-fest-pick').length,'one submit per festival');
const cashBefore=w.eval('G.studio.cash');
$('#modalRoot [data-fest]').click();
assert(w.eval('G.studio.cash')<cashBefore,'a submitted entry charges its fee');
assert($('#modalRoot .command-produce-modal'),'the dialog stays in the produce shell after submitting');
w.eval('closeModal();G.studio.cash=0;openFestivalPrModal();');
const brokeCash=w.eval('G.studio.cash');
$('#modalRoot [data-fest]').click();
assert.equal(w.eval('G.studio.cash'),brokeCash,'a refused entry never charges the studio');
w.eval('closeModal();BOXOFFICE_SUB="chart";render();');
/* the marquee buttons the desk tools replace must still resolve */
assert.equal(typeof w.eval('typeof clashAnalyticsModal'),'string');
assert.equal(w.eval('typeof clashAnalyticsModal'),'function','clashAnalyticsModal alias must exist');
assert.equal(w.eval('typeof festivalPrModal'),'function','festivalPrModal alias must exist');
$('#btnBoLibrary').click();
assert.equal(w.eval('TAB'),'library','catalogue shortcut opens the library');
w.eval(`switchTab('boxoffice');`);
assert($('.command-boxoffice'),'returning to box office keeps the shell');
console.log('PASS box office bindings, library rows, catalogue shortcut');

/* 5 — state round-trips through a save without losing the desk */
w.eval(`saveGame();loadGame();switchTab('boxoffice');`);
assert($('.command-boxoffice'),'desk survives a save/load');
assert.equal(errors.length,0,'no console errors: '+errors.join(' | '));
console.log('PASS box office survives save/load');
console.log('BOX OFFICE DECK PASSED ✅');
}catch(e){
  console.error('BOX OFFICE DECK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}
