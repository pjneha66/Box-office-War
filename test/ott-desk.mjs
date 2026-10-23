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
  const firstSection=$('#view .section-title');
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

  assert.deepEqual(errors,[],'no console errors: '+errors.join(' | '));
  console.log('OTT DESK PASSED ✅');
}catch(e){
  console.error('OTT DESK FAILED ❌',e&&e.stack||e);
  process.exitCode=1;
}finally{
  w.close();
}
