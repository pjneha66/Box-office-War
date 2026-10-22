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

/* ── 12. Cast directory: the whole roster, animal stars included ────── */
w.eval("DEVELOP_SUB='talent';G.castPins={film:null,series:null};render();");
assert($('.cast-desk'),'talent desk must offer a cast directory');
assert.equal($('.cast-desk [data-cast-unpin]'),null,'no stale pins for a fresh studio');
w.eval('unlockAllCast();render();');
const rosterSize=w.eval('G.talent.length');
assert(rosterSize>=100,'the unlock must produce a deep roster (got '+rosterSize+')');
assert(w.eval('G.talent.filter(t=>t.isAnimal).length')>=72,'every animal species must be in the pool');
/* 1,000+ performers must open quickly and stay searchable. */
w.eval(`for(let i=0;i<900;i++) G.talent.push({id:900000+i,kind:'actor',name:'Extra Performer '+i,power:2+(i%4),skill:50+(i%45),fee:4,heat:1,genreFit:null,age:25,scandal:0,pics:0});`);
const bigTotal=w.eval('G.talent.length');
assert(bigTotal>=1000,'the directory must handle 1,000+ performers (got '+bigTotal+')');
click($('#btnOpenCastDirectory'));
const dir=$('#modalRoot .modal');
assert(dir,'cast directory must open');
assert(dir.classList.contains('command-develop-modal'),'cast directory must use the Develop dialog skin');
assert.equal($$('.cast-row').length,60,'the directory pages its rows instead of painting the whole roster');
assert($('#castDirCount').textContent.includes(bigTotal.toLocaleString()),'the directory must report the full roster size');
/* search */
const search=$('#castDirSearch');
search.value='aardvark';
search.dispatchEvent(new w.Event('input',{bubbles:true}));
assert.equal($$('.cast-row').length,1,'searching a species must narrow the directory');
assert($('.cast-row-id small').textContent.includes('Animal actor'),'animal rows must be labelled');
/* availability filter */
w.eval("CAST_DIR.q='';CAST_DIR.filter='animal';castDirSync(document.querySelector('#modalRoot .modal'));");
assert.equal(w.eval('CAST_DIR.limit=200;castDirSync(document.querySelector(\'#modalRoot .modal\'));document.querySelectorAll(\'.cast-row\').length'),72,'the animal filter must list all 72 species once paged out');
/* pin + auto-attach */
w.eval("CASTA=G.talent.find(t=>t.isAnimal);pinCast(CASTA.id,'film');");
assert.equal(w.eval('G.castPins.film'),w.eval('G.talent.find(t=>t.isAnimal).id'),'pinning must persist on the save state');
w.eval("closeModal();startFilmPitchWizard();");
assert(w.eval('WZ.cast.some(c=>c.isAnimal)'),'a pinned animal star must board the next film pitch');
w.eval("closeModal();WZ=null;");
/* series wizard carries the same cast flow */
w.eval("pinCast(G.talent.filter(t=>t.isAnimal)[1].id,'series');startSeriesWizard();");
assert(w.eval('WZ.cast.some(c=>c.isAnimal)'),'a pinned animal star must board the next series pitch');
w.eval("WZ.showrunner=freeTalent('director')[0];WZ.szStep=2;seriesModal();");
assert($$('[data-szcast]').length>0,'the series wizard must offer a cast step');
assert.equal($$('.cast-pick.sel').length,1,'the pinned lead must already be selected');
const pick=$$('[data-szcast]').find(b=>!b.classList.contains('sel'));
click(pick);
assert.equal($$('.cast-pick.sel').length,2,'a second lead can be added to a season');
w.eval("const t=document.querySelector('#szToPlat');t.click();G.streamer=G.streamer||{name:'Own',color:'#333',logo:'O'};WZ.platform='own';seriesModal();document.querySelector('#szPitch').click();");
const series=w.eval('(G.series||[]).slice(-1)[0]');
assert(series&&series.cast&&series.cast.length===2,'the series must be greenlit with both leads (got '+(series&&series.cast&&series.cast.length)+')');
assert.equal(w.eval('G.castPins.series'),null,'a used pin is consumed so it does not repeat');
/* the legacy market modal is retired in favour of the directory */
w.eval("closeModal();openBOS2TalentModal();");
assert($('#castDirList'),'the legacy animal market must forward to the cast directory');
assert.equal($('#bos2TalentModal'),null,'the old navy/gold market modal must be gone');
w.eval("closeModal();G.castPins={film:null,series:null};G.talent=G.talent.filter(t=>!String(t.name).startsWith('Extra Performer'));");

/* ── 11. Console cleanliness ───────────────────────────────────────── */
assert.deepEqual(errors.filter(e=>!/Not implemented: navigation/.test(e)),[],'unexpected console errors');
console.log('PASS develop deck: seven sections, live metrics, filters, rights, crew, lens, combos, partner desks and command dialogs');
