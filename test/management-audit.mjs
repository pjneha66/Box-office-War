import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
try{
await new Promise(r=>setTimeout(r,1000));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Audit Studio',SEL);enterApp(false);G.studio.cash=100000;`);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
let opened=0;
for(const [tab,subs] of [['dashboard',['overview','actions','slate','macro']],['studio',['lot','csuite','board','operations','crisis','heritage']]]){
 for(const sub of subs){
 w.eval(`closeModal();${tab==='studio'?'STUDIO_SUB':'DASHBOARD_SUB'}='${sub}';switchTab('${tab}');`);
 assert($('.command-deck'),`${tab}/${sub} missing branded interior`);
 assert(!$('#view').textContent.includes('RECOVERY INTERFACE'));
 assert.equal($$('.command-section-nav').length,1);
 const ids=$$('#view button[id]').map(b=>b.id).filter(id=>!['btnShareCard'].includes(id));
 for(const id of ids){
 w.eval(`closeModal();${tab==='studio'?'STUDIO_SUB':'DASHBOARD_SUB'}='${sub}';switchTab('${tab}');`);
 const b=$('#'+id);if(!b||b.disabled)continue;
 if(id.startsWith('btnOpen')||['btnRestorationVault','btnAch'].includes(id)||id.startsWith('btnDash')){
 assert.equal(typeof b.onclick,'function',`${tab}/${sub}/${id} unwired`);
 b.click();assert($('.modal'),`${id} did not open a destination`);
 assert($('.command-modal'),`${id} did not open branded destination`);
 assert($('.management-workspace, .command-dialog'),`${id} retained the old dialog layout`);
 if($('.management-workspace')){
   assert($('.workspace-hero h2'));assert($('.workspace-rail button'));assert($('.workspace-content'));
   $('.workspace-rail button').click();assert($('.workspace-rail button.active'));
 }
 opened++;
 }
 }
 console.log('PASS subtab',tab,sub);
 }
}
w.eval(`closeModal();STUDIO_SUB='csuite';switchTab('studio');`);
const officer=$('[data-csuite-hire]');assert(officer);const before=w.eval('G.studio.cash');officer.click();assert(w.eval('G.studio.cash')<before);assert($('[data-csuite-hire]')||$('#view').textContent.includes('Contract Active'));
// Leadership must use appointment dossiers, not the former generic cards.
assert($('.leadership-workspace'));assert.equal($$('.leadership-profile').length,w.eval('StudioOperationsSuite.CSUITE_OFFICERS.length'));
assert.equal($$('#view .command-page-content .card').length,0);
const hiredId=$('.leadership-profile.appointed').dataset.officerId;
const duplicateCash=w.eval('G.studio.cash');
assert(!w.eval(`StudioOperationsSuite.hireCSuiteOfficer('${hiredId}').ok`));assert.equal(w.eval('G.studio.cash'),duplicateCash);
// Workforce recovery must target numeric IDs received from button datasets.
w.eval(`window.restPerson=G.talent.find(t=>!t.retired);GameDevHardware.getAverageStaffStamina();G.gameDevHardware.staffStamina[restPerson.id]=12;STUDIO_SUB='operations';render();`);
assert($('.workforce-workspace'));assert(!$('#view .command-page-content .card'));
assert.equal($$('.workforce-person').length,w.eval('G.talent.filter(t=>!t.retired).length'));
$('#workforceSearch').value='not a real employee 999';$('#workforceSearch').dispatchEvent(new w.Event('input'));
assert.equal($$('.workforce-person:not([hidden])').length,0);
$('#workforceSearch').value='';$('#workforceFilter').value='tired';$('#workforceFilter').dispatchEvent(new w.Event('change'));
assert($$('.workforce-person:not([hidden])').every(row=>row.dataset.workforceTired==='true'));
const recoveryCash=w.eval('G.studio.cash');
$(`[data-sabbatical-id="${w.eval('restPerson.id')}"]`).click();
assert.equal(w.eval('G.gameDevHardware.staffStamina[restPerson.id]'),100);
assert(Math.abs(w.eval('G.studio.cash')-(recoveryCash-.2))<.001);
assert.equal(JSON.parse(w.localStorage.getItem('bow_save')).gameDevHardware.staffStamina[w.eval('restPerson.id')],100);
w.eval(`window.cashBeforeReject=G.studio.cash;window.missingRest=GameDevHardware.sendOnSabbatical('no-such-id');`);
assert(!w.eval('missingRest.ok'));assert.equal(w.eval('G.studio.cash'),w.eval('cashBeforeReject'));
w.eval(`G.studio.cash=0;G.gameDevHardware.staffStamina[restPerson.id]=12;window.unfundedRest=GameDevHardware.sendOnSabbatical(String(restPerson.id));`);
assert(!w.eval('unfundedRest.ok'));assert.equal(w.eval('G.gameDevHardware.staffStamina[restPerson.id]'),12);assert.equal(w.eval('G.studio.cash'),0);
w.eval(`G.studio.cash=cashBeforeReject;G.piracy=60;render();`);
const protectionCash=w.eval('G.studio.cash');$('#btnDeployAntiPiracy').click();assert.equal(w.eval('G.piracy'),42);assert.equal(w.eval('G.studio.cash'),protectionCash-4);
w.eval(`STUDIO_SUB='lot';render();`);$('.command-services').open=true;
const stage=$('[data-stage-buy]');assert(stage);const cash=w.eval('G.studio.cash');stage.click();assert(w.eval('G.studio.cash')<cash);
// Bespoke Strategy page and review must not regress to the old control-room cards.
w.eval(`closeModal();STUDIO_SUB='board';switchTab('studio');`);
assert($('.strategy-workspace'));assert(!$('#view').textContent.includes('Control room'));
$('#btnOpenBoard').click();assert($('.strategy-review .strategy-directive'));
assert(!$('.strategy-review .card'));w.eval('closeModal()');
// A series-only documentary was randomly selected by the film pitch entry point.
w.eval(`closeModal();window.originalPick=pick;pick=arr=>arr[arr.length-1];startFilmPitchWizard();pick=originalPick;`);
assert(w.eval('!!DATA.GENRES[WZ.genre]'));assert($('[data-g]'),'film pitch must open even for the last genre');
// Contract integration: a real signing, casting click, greenlight, and save/load.
w.eval(`closeModal();G.studio.cash=100000;window.partner=G.talent.find(t=>t.kind==='actor'&&!t.retired);partner.bookedUntil=G.week-1;window.dirPartner=G.talent.find(t=>t.kind==='director'&&!t.retired);dirPartner.bookedUntil=0;window.signed=signMultiPictureDeal(partner.id,3);window.dirSigned=signMultiPictureDeal(dirPartner.id,5);`);
assert(w.eval('signed.ok && dirSigned.ok'));assert(w.eval('freeTalent("actor").some(t=>t.id===partner.id)'));
assert.equal(w.eval('actorFee(partner)'),w.eval('signed.contract.lockedRate'));
w.eval(`closeModal();switchTab('studio');openTalentContractsModal();`);
assert($('.partner-ledger'));assert($('.partner-roster'));assert(!$('.picture-partners .card'));
$('#partnerSearch').value='no such person 999';$('#partnerSearch').dispatchEvent(new w.Event('input'));
assert.equal($$('.partner-person:not([hidden])').length,0);
$('#partnerSearch').value='';$('#partnerRole').value='signed';$('#partnerRole').dispatchEvent(new w.Event('change'));
assert.equal($$('.partner-person:not([hidden])').length,2);
assert($('#btnPactDevelop'));$('#btnPactDevelop').click();assert.equal(w.eval('TAB'),'develop');
// Insufficient funds must not mutate cash or register a pact.
w.eval(`window.spare=G.talent.find(t=>!t.retired&&t.id!==partner.id&&t.id!==dirPartner.id);window.savedCash=G.studio.cash;G.studio.cash=0;window.rejected=signMultiPictureDeal(spare.id,5);`);
assert(!w.eval('rejected.ok'));assert.equal(w.eval('G.studio.cash'),0);
w.eval('G.studio.cash=savedCash');
const signingCash=w.eval('G.studio.cash');w.eval('window.duplicate=signMultiPictureDeal(partner.id,3)');assert(!w.eval('duplicate.ok'));assert.equal(w.eval('G.studio.cash'),signingCash);
w.eval(`switchTab('develop');startWizard(G.ideas[0]);WZ.sub=3;wizardModal();`);
assert($(`[data-dir="${w.eval('dirPartner.id')}"]`));$(`[data-dir="${w.eval('dirPartner.id')}"]`).click();
w.eval('WZ.sub=4;wizardModal()');const card=$(`[data-cast="${w.eval('partner.id')}"]`);assert(card,'signed partner missing in casting');assert(card.textContent.includes('Studio partner'));card.click();assert(w.eval('WZ.cast.some(t=>t.id===partner.id)'));
w.eval(`window.testFilm=greenlight({idea:G.ideas[0],budget:40,director:dirPartner,cast:[partner],writer:null,producer:null,plan:'theatrical',location:'home'});`);
assert.equal(w.eval('signed.contract.picturesRemaining'),2);assert.equal(w.eval('dirSigned.contract.picturesRemaining'),4);
assert(!w.eval('consumeContractPicture(partner.id,testFilm.id)'));assert.equal(w.eval('signed.contract.picturesRemaining'),2);
assert(!w.eval('freeTalent("actor").some(t=>t.id===partner.id)'),'busy partner should stay unavailable');
w.eval(`saveGame();loadGame();`);assert(w.eval('G.talentPacts.activeContracts.some(c=>c.talentId===partner.id&&c.picturesRemaining===2)'));
w.eval(`window.after=G.talentPacts.activeContracts.find(c=>c.talentId===partner.id);consumeContractPicture(partner.id,'second');consumeContractPicture(partner.id,'third');`);
assert(w.eval('G.talentPacts.completedContracts.some(c=>c.talentId===partner.id)'));assert(!w.eval('G.talentPacts.activeContracts.some(c=>c.talentId===partner.id)'));
assert.deepEqual(errors,[]);
console.log(`PASS ${opened} management destinations, leadership hire, stage purchase, multi-picture signing → wizard casting → greenlight → idempotent consumption → save/load → completion`);
}finally{w.close()}
