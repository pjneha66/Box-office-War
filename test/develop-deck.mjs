/* Story Department (Develop) regression suite.
   Boots the real app in JSDOM and exercises the seven sections, their wiring,
   and the defect fixes made during the Develop redesign. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];
vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s);
const $$=s=>Array.from(w.document.querySelectorAll(s));
const click=el=>{ assert(el,'click target missing'); el.click(); };
const view=()=>$('#view');

await new Promise(r=>setTimeout(r,1200));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Develop <Test>',SEL);enterApp(false);switchTab('develop');`);

/* ── 1. The screen is one command deck with one navigation ───────────── */
assert.equal(view().dataset.screen,'develop');
assert($('.command-deck.command-develop'),'Develop must render the command deck');
assert.equal($('.kairo-dept-banner'),null,'the legacy Kairo banner (invented metrics) must not render on Develop');
assert.equal($('#subTabs').style.display,'none','the duplicate mobile sub-tab strip must stay hidden');
assert.equal($$('#view .subnav-pills').length,0,'the pixel-icon pill strip must be gone');
assert.equal($$('.command-develop-nav [data-devsub]').length,7,'seven numbered sections');
assert.equal($$('.command-develop-nav .command-nav-tools button').length,3,'three tool destinations');
assert($('.command-develop-nav [data-devsub="scripts"]').classList.contains('active'));
const developHtml=view().innerHTML;
assert(!/94% Brainstorm|Active Shift/.test(developHtml),'no invented telemetry copy');

/* No duplicate element ids anywhere in the screen. */
const ids=$$('#view [id]').map(e=>e.id);
assert.equal(ids.length,new Set(ids).size,'duplicate ids in the Develop view: '+ids.filter((id,i)=>ids.indexOf(id)!==i).join(','));

/* ── 2. All seven sections render real content ──────────────────────── */
const sections=[['scripts','Scripts'],['demographics','Audience lab'],['creativity','Craft & vault'],['ip','Rights market'],['talent','Talent desk'],['combos','Combos codex'],['tax','Locations & partners']];
for(const [key,label] of sections){
  const nav=$$('.command-develop-nav [data-devsub]').find(b=>b.dataset.devsub===key);
  assert(nav,key+' section missing from navigation');
  assert.equal(nav.querySelector('span').textContent,label);
  click(nav);
  assert.equal(w.eval('DEVELOP_SUB'),key);
  assert($('#view .command-deck.command-develop'),key+' must render the command deck');
  assert($('#view .command-telemetry').children.length>=4,key+' telemetry incomplete');
  assert(view().textContent.trim().length>200,key+' rendered nearly empty');
  assert.equal(view().querySelectorAll('.kairo-dept-banner').length,0);
}

/* ── 3. Script market: filter wiring (was a dead click target) ──────── */
w.eval("DEVELOP_SUB='scripts';render();");
const allCards=$$('.develop-script').length;
assert.equal(allCards,w.eval('G.ideas.length'),'every draft should be listed');
const genreBtn=$$('[data-filter-genre]').find(b=>b.dataset.filterGenre!=='all');
assert(genreBtn,'genre filter buttons missing');
click(genreBtn);
assert.equal(w.eval('SCRIPT_GENRE_FILTER'),genreBtn.dataset.filterGenre,'genre filter click must update state');
const filtered=$$('.develop-script').length;
assert.equal(filtered,w.eval(`G.ideas.filter(i=>i.genre==='${genreBtn.dataset.filterGenre}').length`),'filtered cards must match the genre');
click($$('[data-filter-genre]').find(b=>b.dataset.filterGenre==='all'));
assert.equal($$('.develop-script').length,allCards);

/* ── 4. Genre board + intelligence table ───────────────────────────── */
assert.equal($$('.develop-trend').length,Object.keys(w.eval('DATA.GENRES')).length,'one trend row per genre');
assert($('.develop-table'),'genre intelligence table missing');
assert.equal($$('.develop-table tbody tr').length,Object.keys(w.eval('DATA.GENRES')).length);
assert.equal($$('.develop-season-cell').length,52,'52-week corridor must show every week');

/* ── 5. Rights market buys rights ──────────────────────────────────── */
w.eval("DEVELOP_SUB='ip';render();G.studio.cash=500;");
const ideasBefore=w.eval('G.ideas.length');
const buyBtn=$('[data-ip]');
assert(buyBtn,'rights purchase button missing');
const cashBefore=w.eval('G.studio.cash');
click(buyBtn);
assert(w.eval('G.ideas.length')>ideasBefore,'buying rights must add an adaptation to the desk');
assert(w.eval('G.studio.cash')<cashBefore,'buying rights must debit development cash');

/* ── 6. Talent desk: markets, crew, agencies, RPG sheets ───────────── */
w.eval("DEVELOP_SUB='talent';render();G.studio.cash=Math.max(G.studio.cash,900);");
for(const label of ['WRITERS ON THE MARKET','PRODUCERS ON THE MARKET','DIRECTORS ON THE MARKET','CAST ON THE MARKET']){
  assert(view().innerHTML.includes(label),label+' missing');
}
assert(view().innerHTML.includes('Below-the-line crew'),'crew desk missing');
assert($$("#view [onclick*='characterSheet']").length>0,'RPG sheet buttons missing on talent cards');

const hire=$$('[data-btlhire]')[0];
assert(hire,'below-the-line hire button missing');
click(hire);
assert(w.eval('G.btl && (G.btl.dp||G.btl.composer||G.btl.vfx)'),'below-the-line hire must take effect');

const agDeal=$$('[data-agdeal]')[0];
if(agDeal){
  const cash=w.eval('G.studio.cash');
  click(agDeal);
  assert(w.eval('Object.keys(G.agencyDeals||{}).length>0'),'agency exclusive must be recorded');
  assert(w.eval('G.studio.cash')<cash,'agency exclusive must debit cash');
}

/* Wrap deal + town truce persist (previously lost on reload). */
w.eval("DEVELOP_SUB='talent';render();G.studio.cash=Math.max(G.studio.cash,200);G.wrapDeal=0;");
click($('#btnWrap'));
assert.equal(w.eval('G.wrapDeal'),3,'wrap deal must apply');
assert.equal(w.eval("JSON.parse(localStorage.getItem('bow_save_v33')||localStorage.getItem('bow_save')||'{}').wrapDeal"),3,'wrap deal must be saved');
w.eval("G.agencyExcl=0;render();");
assert($('#btnAgency'),'truce button missing');
click($('#btnAgency'));
assert(w.eval('G.agencyExcl')>w.eval('G.week'),'town-wide truce must apply');
assert(w.eval("JSON.parse(localStorage.getItem('bow_save_v33')||localStorage.getItem('bow_save')||'{}').agencyExcl")===w.eval('G.agencyExcl'),'truce must be saved');

/* ── 7. Craft & vault: lens fit + writers room ─────────────────────── */
w.eval("DEVELOP_SUB='creativity';render();G.projects.push({id:'dev-test-1',title:'Lens Test',genre:'drama',phase:'pre',budget:20,quality:60});render();");
assert($('.develop-fit'),'lens fitting panel missing');
const fitBtn=$('[data-fit-lens]');
assert(fitBtn,'fit-lens button missing');
const qualityBefore=w.eval("G.projects.find(p=>p.id==='dev-test-1').quality");
click(fitBtn);
assert(w.eval("G.projects.find(p=>p.id==='dev-test-1').quality")>qualityBefore,'fitting a lens must raise quality');
assert(w.eval("!!G.projects.find(p=>p.id==='dev-test-1').cameraFormat"),'lens choice must be recorded on the project');
w.eval("G.studio.cash=Math.max(G.studio.cash,50);render();");
const roomBefore=w.eval('G.productionSuite.writersRoomLevel');
click($('#btnExpandWritersRoom'));
assert.equal(w.eval('G.productionSuite.writersRoomLevel'),roomBefore+1,'writers room expansion must apply');

/* ── 8. Combos codex filtering ─────────────────────────────────────── */
w.eval("DEVELOP_SUB='combos';render();");
assert($$('.develop-combo').length>0,'combo chips missing');
const loveBtn=$$('[data-combo-filter]').find(b=>b.dataset.comboFilter==='love');
click(loveBtn);
assert.equal(w.eval('DEVELOP_COMBO_FILTER'),'love');
assert.equal($$('.develop-combo').length,w.eval("Object.values(G.comboKnown||{}).filter(v=>v==='love').length"),'filter must show only discovered matches');

/* ── 9. Locations & partners: co-pro and sponsor desks ─────────────── */
w.eval("DEVELOP_SUB='tax';render();");
assert($$('.develop-destination').length>0,'destination cards missing');
click($('#btnDevelopCoPro'));
assert($('#modalRoot .modal'),'co-production desk must open');
w.document.querySelector('#modalRoot').innerHTML='';
click($('#btnDevelopSponsors'));
assert($('#modalRoot .modal'),'brand placement desk must open');
w.document.querySelector('#modalRoot').innerHTML='';

/* ── 10. Dialogs opened from Develop share the deck identity ───────── */
for(const [sel,label] of [['#btnOpenContracts','picture partners'],['#btnOpenAgencyPackaging','agency packaging'],['#btnOpenTalentAgency','talent agency'],['#btnPitchFilm','film pitch'],['#btnPitchSeries','series pitch'],['#btnClashAnalytics','clash radar']]){
  w.eval("DEVELOP_SUB='scripts';render();");
  const btn=$(sel);
  if(!btn) throw new Error(label+' button missing');
  click(btn);
  const modal=$('#modalRoot .modal');
  assert(modal,label+' dialog did not open');
  assert(modal.classList.contains('command-modal'),label+' dialog must use the command modal');
  assert(modal.classList.contains('command-develop-modal'),label+' dialog must be skinned for Develop');
  w.document.querySelector('#modalRoot').innerHTML='';
}

/* Clash radar without an active project must explain itself rather than fail silently. */
w.eval("G.projects=[];DEVELOP_SUB='scripts';render();");
click($('#btnClashAnalytics'));
assert(!$('#modalRoot .modal'),'clash radar should not invent a project');
assert($('#toasts').textContent.toLowerCase().includes('clash'),'clash radar must explain why it cannot analyse');

/* ── 11. Console cleanliness ───────────────────────────────────────── */
assert.deepEqual(errors.filter(e=>!/Not implemented: navigation/.test(e)),[],'unexpected console errors');
console.log('PASS develop deck: seven sections, live metrics, filters, rights, crew, lens, combos, partner desks and command dialogs');
