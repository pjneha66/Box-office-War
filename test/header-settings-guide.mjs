import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('index.html','utf8').replace(/<script src="([^"]+\.js)(?:\?v=[^"]*)?"><\/script>/g,(_,file)=>'<script>'+fs.readFileSync(file,'utf8')+'</script>').replace(/<script>\s*\/\* PWA[^]*?<\/script>/,'');
const vc=new VirtualConsole(),errors=[];vc.on('error',(...a)=>errors.push(a.join(' ')));
const dom=new JSDOM(html,{runScripts:'dangerously',url:'http://localhost/',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
try{
await new Promise(r=>setTimeout(r,1000));
w.eval(`render=function(){_renderImpl()};SEL={scenario:'standard',difficulty:'normal',sandbox:false,slot:1,legacy:''};newGame(DATA.ARCHETYPES[1].id,'Header Test Studio',SEL);enterApp(false);closeModal();`);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
assert($('.command-header-identity'));assert.equal($('#brandName').textContent,'Header Test Studio');
for(const id of ['brandName','chipCash','chipDebt','chipRep','chipDate','btnWeek','btnFast','btnAuto','btnSpeed','btnBell','btnSound','btnSettings','btnHelp'])assert.equal($$('#'+id).length,1,id+' must remain unique');
$('#btnHelp').click();assert($('.field-guide'));assert.equal($$('.guide-topic').length,12);assert(!$('.field-guide .card'));
$('[data-guide-chapter="people"]').click();assert.equal($$('.guide-topic:not([hidden])').length,3);
$('#helpSearch').value='multi-picture';$('#helpSearch').dispatchEvent(new w.Event('input'));assert.equal($$('.guide-topic:not([hidden])').length,1);
$('#helpSearch').value='no topic 999';$('#helpSearch').dispatchEvent(new w.Event('input'));assert.equal($('.guide-no-results').hidden,false);
$('.field-guide .modal-actions button').click();assert(!$('.modal'));
$('#btnSettings').click();assert($('.preferences-workspace'));assert(!$('.preferences-workspace .card'));
assert.equal($$('.preferences-panel').length,6);
for(const button of $$('.preferences-nav>button')){button.click();assert.equal($$('.preferences-panel:not([hidden])').length,1);assert.equal($('.preferences-panel:not([hidden])').dataset.prefContent,button.dataset.prefPanel);}
$('[data-pref-panel="experience"]').click();$('#langHi').click();assert.equal(w.localStorage.getItem('bow_lang'),'hi');assert($('.preferences-workspace'));assert($('#btnWeek').textContent.includes('अगला'));
$('#langEn').click();assert($('#btnWeek').textContent.toLowerCase().includes('next'));
$('[data-curr="INR"]').click();assert.equal(w.eval('getActiveCurrencyCode()'),'INR');assert($('.preferences-workspace'));$('[data-curr="USD"]').click();
$('[data-pref-panel="access"]').click();$('#fontPlus').click();assert.equal(w.localStorage.getItem('bow_font'),'16px');$('#fontReset').click();assert.equal(w.localStorage.getItem('bow_font'),'15px');
$('[data-motion="off"]').click();assert.equal(w.localStorage.getItem('bow_motion'),'off');assert.equal($('.preferences-panel:not([hidden])').dataset.prefContent,'access');
$('[data-pref-panel="audio"]').click();$('#sndMuteToggle').click();assert(w.localStorage.getItem('bow_mute_until'));$('#sndMuteToggle').click();assert(!w.localStorage.getItem('bow_mute_until'));
$('[data-pref-panel="career"]').click();$('#stName').value='New Header Studio';$('#stNameSave').click();assert.equal($('#brandName').textContent,'New Header Studio');
$('[data-pref-panel="saves"]').click();$('#btnExport').click();assert($('#saveCode').value.length>100);$('[data-saveslot="2"]').click();assert.equal(w.eval('G.slot'),2);assert(w.localStorage.getItem('bow_slot2'));
$('[data-pref-panel="device"]').click();assert($('#btnPrivacy'));assert.equal(typeof $('#btnPrivacy').onclick,'function');
w.eval('closeModal()');$('#chipCashWrap').click();assert($('.modal'));w.eval('closeModal()');$('#chipDateWrap').click();assert($('.modal'));w.eval('closeModal()');
assert.deepEqual(errors,[]);console.log('PASS header IDs/navigation, guide chapters/search, settings panels, language, currency, font, motion, sound, rename, export, and save slots');
}finally{w.close()}
