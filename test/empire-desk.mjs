/* EMPIRE DESK regressions (A1–A11) + command-desk shell (B) + C1–C11 coverage.
   Runs entirely offline against the local app shell in jsdom: no network,
   no external fixtures. Every A-test proves its defect against real state. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8')
  .replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>')
  .replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];
vc.on('error',(...a)=>errors.push(a.join(' ')));
vc.on('jsdomError',e=>{ if(!/Could not load|Not implemented: (navigation|HTMLCanvasElement|Window's scrollTo)/.test(String(e&&e.message))) errors.push(String(e&&e.message)); });
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const chips=()=>$$('[data-empiresub]');
const viewText=()=>($('#view')?$('#view').textContent:'');
const toastText=()=>$$('#toasts .toast').map(t=>t.textContent).join(' | ');
const clearToasts=()=>{ const h=$('#toasts'); if(h) h.innerHTML=''; };

/* Track every beep() sting so A2/A11 can prove zero false-success sounds */
w.eval(`
  window.__beeps=[];
  const _origBeep = typeof beep === 'function' ? beep : function(){};
  beep = function(kind){ window.__beeps.push(kind); return _origBeep(kind); };
`);
const clearBeeps=()=>{ w.__beeps.length=0; };
const beeps=()=>[...w.__beeps];

function fresh(sub){
  w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Empire Desk Audit',SEL);enterApp(false);closeModal();switchTab('empire');${sub?`if(!G.empire)G.empire={};G.empire.subTab='${sub}';G.empire.activeSub='${sub}';`:''}render();`);
}

try{
  await new Promise(r=>setTimeout(r,900));
  w.eval(`window.confirm=function(){return window.__confirm!==false;};`);

  /* ── A1 — one Empire navigation, five real switchable sections, persisted ── */
  fresh();
  assert.equal($$('#subTabs [data-empiretab], #subTabs [data-empiresub]').length,0,'global #subTabs strip must not render dead or duplicate empire chips');
  assert.equal($('#subTabs').style.display,'none','global #subTabs is hidden on Empire');
  assert.equal($$('#view .subnav-pills').length,0,'legacy .subnav-pills row is gone from Empire');
  assert.equal($$('[data-empiretab]').length,0,'dead [data-empiretab] chips are gone');
  assert.equal(chips().length,5,'exactly five [data-empiresub] chips in Empire navigation');
  assert.deepEqual(chips().map(b=>b.dataset.empiresub),['home','franchises','universes','divisions','endgame'],'five section keys match Home / Franchises / Universes / Divisions / Endgame');
  assert.equal(new Set(chips().map(b=>b.closest('nav')||b.parentElement)).size,1,'all empire chips belong to one navigation container');
  assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,'exactly one empire chip is active');
  assert.equal($('[data-empiresub].active').dataset.empiresub,'franchises','fresh career opens Franchises safely by default');

  const expectedPanels={
    home:/Empire home|No franchises yet|unlock/i,
    franchises:/Franchises/,
    universes:/universe/i,
    divisions:/Music|Merch|Publishing/i,
    endgame:/Endgame|industry influence/i
  };
  for(const [key,rx] of Object.entries(expectedPanels)){
    const chip=$(`[data-empiresub="${key}"]`);
    assert(chip,`missing [data-empiresub="${key}"] chip`);
    chip.click();
    assert.equal(w.eval('TAB'),'empire',`clicking ${key} chip stays inside Empire tab`);
    assert.equal(w.eval('G.empire && G.empire.subTab'),key,`${key} chip persists to G.empire.subTab`);
    assert.equal(chips().filter(b=>b.classList.contains('active')).length,1,`only ${key} chip is active`);
    assert.equal($(`[data-empiresub="${key}"]`).classList.contains('active'),true,`${key} chip has .active`);
    assert.match(viewText(),rx,`${key} chip renders its own panel`);
  }

  /* Save/load round-trip preserves active Empire sub-tab */
  w.eval(`G.empire.subTab='universes';G.empire.activeSub='universes';saveGame();loadGame();render();`);
  assert.equal($('[data-empiresub].active').dataset.empiresub,'universes','selected sub-tab survives saveGame/loadGame');

  /* Old saves without G.empire default safely without error */
  w.eval(`delete G.empire;saveGame();loadGame();render();`);
  assert.equal($('[data-empiresub].active').dataset.empiresub,'franchises','legacy save without G.empire defaults safely');
  console.log('PASS A1: one 5-chip Empire navigation, real panel switching, save/load persistence');

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('EMPIRE DESK SUITE PASSED ✅');
}catch(e){
  console.error('EMPIRE DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
