/* Rebrand (streamer rename) — entry points, branded dialog and states.
   1. the platform card on OTT › Home owns a Rebrand control, wired;
   2. it opens the command-produce shell (head / body / foot), not a bare modal;
   3. empty, same-name and rejected saves report in place without closing;
   4. a good save renames the platform, keeps subscribers/deals, and closes;
   5. the legacy renameModal('st') entry routes to the same dialog, and every
      historic ID (rnInput / rnSave / rnCancel) still exists. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const modal=()=>$('#modalRoot .modal');
try{
await new Promise(r=>setTimeout(r,900));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Rebrand Audit',SEL);enterApp(false);closeModal();
G.streamer={name:'Bow+',subs:12.5,income:6,sportsPower:1,churn:0.008,lastContent:G.week};
switchTab('ott');OTT_SUB='home';render();`);

/* 1 — the control lives on the platform card it rebrands */
const btn=$('[data-rebrand-streamer]');
assert(btn,'OTT Home platform card must offer a Rebrand control');
assert.equal(typeof btn.onclick,'function','Rebrand control is unwired');
assert(btn.textContent.includes('Rebrand'));
btn.click();
await new Promise(r=>setTimeout(r,50));

/* 2 — branded shell, not a bare dialog */
assert(modal(),'rebrand did not open a dialog');
assert.equal(modal().classList.contains('command-produce-modal'),true,'rebrand must wear the command-produce shell');
assert($('#modalRoot .command-produce-modal .produce-modal-head h3').textContent.includes('Rebrand'));
assert($('#modalRoot .command-produce-modal .produce-modal-body .produce-modal-card'));
assert($('#modalRoot .command-produce-modal .produce-modal-actions #rnSave'));
assert($('#modalRoot .command-produce-modal .produce-modal-actions #rnCancel'));

/* 3 — historic IDs and value preserved */
assert.equal($('#rnInput').value,'Bow+');
assert.equal($('#rnError').hidden,true,'no error before the first save');

/* empty save reports in place */
$('#rnSave').click();
assert($('#rnError').hidden===false,'empty name must surface an error');
assert($('#rnError').textContent.length>10);
assert(modal(),'an invalid save must not close the dialog');
assert.equal(w.eval('G.streamer.name'),'Bow+','invalid save must not rename');
assert.equal($('#rnInput').getAttribute('aria-invalid'),'true');
/* typing clears the error */
$('#rnInput').value='Bo';
$('#rnInput').dispatchEvent(new w.Event('input'));
assert.equal($('#rnError').hidden,true,'typing clears the error');

/* same-name save is a no-op with an explanation */
$('#rnInput').value='Bow+';
$('#rnInput').dispatchEvent(new w.Event('input'));
$('#rnSave').click();
assert($('#rnError').hidden===false,'same-name save must explain itself');
assert.equal(w.eval('G.streamer.name'),'Bow+');
assert(modal(),'same-name save keeps the dialog open');
console.log('PASS rebrand dialog shell, historic IDs, empty/unchanged errors');

/* 4 — a real save renames, keeps the business, closes */
$('#rnInput').value='  Aether+ <script>  ';
$('#rnInput').dispatchEvent(new w.Event('input'));
$('#rnSave').click();
await new Promise(r=>setTimeout(r,30));
assert.equal(w.eval('G.streamer.name'),'Aether+ <script>','name saved and trimmed');
assert.equal(modal(),null,'a successful save closes the dialog');
assert.equal(w.eval('G.streamer.subs'),12.5,'rebrand must not touch subscribers');
assert.equal(w.eval('G.streamer.income'),6,'rebrand must not touch revenue');
assert($('#view').textContent.includes('Aether+ <script>'),'new name renders');
assert(!$('#view').innerHTML.includes('<script>  </b>'),'the name is escaped in the view');
assert.equal(errors.length,0,'no console errors: '+errors.join(' | '));
console.log('PASS rebrand saves, trims, escapes and closes');

/* 5 — legacy entry point routes to the same dialog */
w.eval(`renameModal('st',0)`);
await new Promise(r=>setTimeout(r,30));
assert(modal(),'renameModal(st) must open the rebrand dialog');
assert.equal(modal().classList.contains('command-produce-modal'),true);
assert.equal($('#rnInput').value,'Aether+ <script>');
$('#rnCancel').click();
assert.equal(modal(),null,'cancel closes without saving');
console.log('PASS renameModal(st) routes to the branded rebrand dialog');
console.log('REBRAND DIALOG PASSED ✅');
}catch(e){
  console.error('REBRAND DIALOG FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}
