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

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('OTT DESK PASSED ✅');
}catch(e){
  console.error('OTT DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
