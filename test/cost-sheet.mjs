/* THE COST SHEET — live re-add on every greenlight path.
   Budget slider, cast/team changes, script polish and allocation sliders must
   all re-add the sheet in place. The four figures stay distinct and correct:
     Upfront (ex-P&A)  = development + fees + production
     All-in with P&A   = Upfront + suggested marketing
     Theatrical BE     = breakevenWW(budget + marketing)
     Full-investment BE= All-in / 0.48
   No duplicate "total commitment" line, no stale numbers. */
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const num=s=>Number(String(s).replace(/[^0-9.\-]/g,''));
const sheet=()=>({
  up:num($('#wzTot').textContent),
  all:num($('#wzTotMkt').textContent),
  be:num($('#wzBe').textContent),
  mkt:num($('#wzMkt').textContent),
  upText:$('#wzTot').textContent,
  allText:$('#wzTotMkt').textContent,
  beText:$('#wzBe').textContent
});
const expected=()=>w.eval('(function(){const r=greenlightRead();return {allIn:r.allIn,mkt:r.mkt,allInWithMkt:r.allInWithMkt,fullBreakeven:r.fullBreakeven,dev:r.dev,fees:r.fees,packFee:r.packFee,cameoFee:r.cameoFee,budget:r.budget};})()');
const fmt=(v)=>w.eval(`fmtM(${v})`);
try{
await new Promise(r=>setTimeout(r,900));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Cost Audit',SEL);enterApp(false);closeModal();
startWizard({id:99001,genre:'action',scale:'mid',title:'Cost Sheet Test',script:70,blurb:'Live re-add probe.'});
setWizardStep(6);`);

/* 1 — the sheet exists, with one line per concept and no duplicates */
assert($('#wzTot'),'upfront total missing');
assert($('#wzTotMkt'),'all-in total missing');
assert($('#wzBe'),'breakeven missing');
const lineLabels=$$('.pitch-line span').map(s=>s.textContent.trim());
assert.equal(lineLabels.filter(l=>/total commitment/i.test(l)).length,0,'no duplicate total-commitment line');
assert(lineLabels.some(l=>/Upfront commitment \(ex-P&A\)/.test(l)),'upfront line labelled ex-P&A');
assert(lineLabels.some(l=>/All-in with P&A/.test(l)),'all-in line labelled with P&A');
const first=sheet();
let e=expected();
assert.equal(first.upText,fmt(e.allIn),'upfront = dev + fees + production');
assert.equal(first.allText,fmt(e.allInWithMkt),'all-in = upfront + marketing');
assert.ok(first.all>first.up,'P&A is added on top, never folded into the upfront figure');
assert.equal(first.beText,fmt(e.fullBreakeven),'full breakeven = all-in / 0.48');
assert.ok(first.be>first.all,'breakeven gross is larger than the investment');
console.log('PASS cost sheet: distinct upfront / all-in / breakeven lines');

/* 2 — budget slider re-adds live */
const before=sheet();
$('#wzBudget').value=String(Math.round(+$('#wzBudget').value*1.6));
$('#wzBudget').dispatchEvent(new w.Event('input'));
const after=sheet();
e=expected();
assert.notEqual(after.upText,before.upText,'budget slider must move the upfront total');
assert.equal($('#wzBudgetV').textContent,fmt(e.budget),'budget readout follows the slider');
assert.equal(after.upText,fmt(e.allIn),'upfront re-added from the new budget');
assert.equal(after.allText,fmt(e.allInWithMkt),'all-in re-added from the new budget');
assert.equal(after.beText,fmt(e.fullBreakeven),'breakeven re-added from the new budget');
assert.ok(after.up>before.up,'a bigger negative cost costs more upfront');
assert.ok(after.mkt>before.mkt,'marketing tracks the budget');
console.log('PASS cost sheet: budget slider re-adds totals and breakeven');

/* 3 — attaching a star re-adds the fee lines */
const cheap=sheet();
w.eval(`(function(){const star=G.talent.filter(t=>t.kind==='actor'&&!t.retired).sort((a,b)=>actorFee(b)-actorFee(a))[0];WZ.cast=[star];setWizardStep(6);})()`);
const star=sheet();
e=expected();
assert.equal(star.upText,fmt(e.allIn),'cast fee re-added into the upfront total');
assert.ok(star.up>cheap.up,'a lead fee raises the upfront commitment');
console.log('PASS cost sheet: cast changes re-add the sheet');

/* 4 — script polish and producer re-add the sheet */
const noPolish=sheet();
w.eval(`WZ.scriptPolish=true;setWizardStep(6);`);
const polish=sheet();
e=expected();
assert.equal(polish.upText,fmt(e.allIn));
assert.ok(polish.up>noPolish.up,'script polish is charged into development');
w.eval(`(function(){const p=G.talent.filter(t=>t.kind==='producer'&&!t.retired)[0];WZ.producer=p||null;setWizardStep(6);})()`);
e=expected();
assert.equal(sheet().upText,fmt(e.allIn),'producer fee re-added');
console.log('PASS cost sheet: polish and producer re-add the sheet');

/* 5 — allocation sliders stay normalised to 100% and never break the sheet */
const allocBefore=sheet();
$$('.alSlider').forEach(sl=>{
  sl.value=String(Math.min(50,+sl.value+10));
  sl.dispatchEvent(new w.Event('input'));
});
const allocLabels=$$('.pitch-alloc-sliders .al-row span b').map(b=>num(b.textContent));
assert.equal(allocLabels.length,5);
assert.equal(allocLabels.reduce((a,b)=>a+b,0),100,'allocation split always totals 100%');
const allocAfter=sheet();
assert.equal(allocAfter.upText,allocBefore.upText,'allocation is creative, not extra cash');
assert.equal(allocAfter.allText,allocBefore.allText);
console.log('PASS cost sheet: allocation sliders normalise without inflating cost');

/* 6 — the sheet survives a team re-render from any step */
w.eval(`setWizardStep(4);setWizardStep(6);`);
e=expected();
assert.equal(sheet().upText,fmt(e.allIn),'returning to the deal step keeps the live numbers');
assert.equal(errors.length,0,'no console errors: '+errors.join(' | '));
console.log('PASS cost sheet: live numbers survive step round-trips');
console.log('COST SHEET PASSED ✅');
}catch(err){
  console.error('COST SHEET FAILED ❌',err&&err.stack||err);
  process.exitCode=1;
}
