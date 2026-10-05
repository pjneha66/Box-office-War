/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — i18n.js (v2)
   Hindi / English toggle. The app chrome (topbar, tabs, start
   screen, settings, section titles, common buttons) is fully
   translated; long dynamic news copy stays in English.
   ═══════════════════════════════════════════════════════════ */
"use strict";

const I18N = {
  en: {
    "tab.dashboard":"🏠 Dashboard","tab.library":"📚 Library","tab.studio":"🏛 Studio","tab.develop":"📝 Develop","tab.productions":"🎬 Productions","tab.boxoffice":"📊 Box Office","tab.fans":"📬 Fans","tab.ott":"📺 OTT & Series","tab.empire":"🏰 Empire","tab.games":"🎮 Game Studio","tab.finance":"💼 Finance","tab.notifications":"🔔 Notifications",
    "btab.dashboard":"Home","btab.library":"Library","btab.more":"More","btab.studio":"Studio","btab.develop":"Create","btab.productions":"Films","btab.boxoffice":"Market","btab.fans":"Fans","btab.ott":"OTT","btab.empire":"Empire","btab.finance":"Money",
    "btn.week":"▶ Next Week","btn.fast":"⏩ ×4","btn.help":"❓","btn.settings":"⚙","btn.auto":"⏵⏵",
    "btn.autoOn":"⏸","chip.cash":"Cash on hand","chip.debt":"Debt","chip.rep":"Reputation","chip.date":"Date",
    "start.name":"Name your studio","start.origin":"Choose your origin story","start.scenario":"Scenario",
    "start.difficulty":"Difficulty","start.found":"🎥 Found the Studio","start.continue":"⏵ Continue Saved Game",
    "start.note":"Runs 100% in your browser · saves automatically · works offline",
    "start.sandbox":"🧪 Sandbox mode (no bankruptcy, free experimenting)","start.slot":"Save slot",
    "sec.market":"Script market","sec.talent":"Talent — available now","sec.ipmarket":"📚 IP market — buy the underlying rights",
    "sec.talentbiz":"🤝 Talent business","sec.prod":"In production","sec.ready":"Ready for release",
    "sec.frops":"Franchise opportunities","sec.chart":"This week's chart","sec.live":"Your films in theaters",
    "sec.library":"Library","sec.offers":"Deal offers","sec.series":"Your series","sec.platforms":"The platforms",
    "sec.streamer":"🛰 Your own streamer","sec.sports":"🏟 Live sports rights","sec.invest":"Studio investments",
    "sec.execs":"👔 Executive suite","sec.corp":"🏛 Corporate finance","sec.forecast":"🔮 12-week cash-flow forecast",
    "sec.feed":"Industry feed","sec.share":"Market share","sec.awards":"🏆 Awards season","sec.newfaces":"🌱 New faces",
    "stat.cash":"Cash on hand","stat.lastnet":"Last week net","stat.debt":"Debt","stat.rep":"Reputation",
    "stat.catalog":"Catalog value","stat.films":"Films released","stat.ww":"All-time WW gross",
    "stat.subs":"Subscribers","stat.credit":"Credit limit","stat.overhead":"Overhead",
    "btn.greenlight":"🎥 Greenlight","btn.pitch":"📡 Pitch it","btn.schedule":"📅 Theatrical Release",
    "btn.shop":"📺 Shop to Streamers","btn.accept":"✅ Accept","btn.counter":"📈 Counter","btn.decline":"✕ Decline",
    "btn.loan":"Take loan","btn.repay":"Repay","btn.save":"Save","btn.close":"Close",
    "set.title":"⚙ Settings","set.lang":"🌐 Language","set.font":"🔠 Text size","set.auto":"Auto-play weeks",
    "set.saves":"💾 Save export / import","set.export":"Copy export code","set.import":"Import code",
    "set.slot":"Save to slot","set.menu":"🚪 Back to start screen","set.on":"ON","set.off":"OFF",
    "ach.title":"🏆 Achievements","ach.locked":"Locked",
    "sec.inhouse":"🧪 In-house originals","cs.stats":"📈 Stats","cs.gear":"🎒 Gear","cs.story":"📜 Story",
    "pv.title":"🔒 Privacy & Your Data","pv.note":"Everything stays on this device — no accounts, no trackers.",
    "emp.how":"How the empire works",
    "help.title":"❓ How the movie business works here",
  },
  hi: {
    "tab.dashboard":"🏠 डैशबोर्ड","tab.library":"📚 लाइब्रेरी","tab.studio":"🏛 स्टूडियो","tab.develop":"📝 डेवलप","tab.productions":"🎬 प्रोडक्शन","tab.boxoffice":"📊 बॉक्स ऑफ़िस","tab.fans":"📬 फ़ैंस","tab.ott":"📺 ओटीटी व सीरीज़","tab.empire":"🏰 साम्राज्य","tab.games":"🎮 गेम स्टूडियो","tab.finance":"💼 वित्त","tab.notifications":"🔔 सूचनाएं",
    "btab.dashboard":"होम","btab.library":"लाइब्रेरी","btab.more":"और","btab.studio":"स्टूडियो","btab.develop":"डेवलप","btab.productions":"फ़िल्में","btab.boxoffice":"चार्ट","btab.fans":"फ़ैंस","btab.ott":"ओटीटी","btab.empire":"साम्राज्य","btab.finance":"पैसा",
    "btn.week":"▶ अगला सप्ताह","btn.fast":"⏩ ×4","btn.help":"❓","btn.settings":"⚙","btn.auto":"⏵⏵",
    "btn.autoOn":"⏸","chip.cash":"नकद","chip.debt":"कर्ज़","chip.rep":"साख","chip.date":"तारीख़",
    "start.name":"अपने स्टूडियो का नाम रखें","start.origin":"अपनी शुरुआती कहानी चुनें","start.scenario":"परिदृश्य",
    "start.difficulty":"कठिनाई","start.found":"🎥 स्टूडियो स्थापित करें","start.continue":"⏵ सहेजा गया गेम जारी रखें",
    "start.note":"पूरी तरह ब्राउज़र में चलता है · अपने आप सेव · ऑफ़लाइन भी",
    "start.sandbox":"🧪 सैंडबॉक्स मोड (दिवालियापन नहीं, खुलकर खेलें)","start.slot":"सेव स्लॉट",
    "sec.market":"स्क्रिप्ट बाज़ार","sec.talent":"टैलेंट — अभी उपलब्ध","sec.ipmarket":"📚 आईपी बाज़ार — राइट्स खरीदें",
    "sec.talentbiz":"🤝 टैलेंट बिज़नेस","sec.prod":"प्रोडक्शन में","sec.ready":"रिलीज़ के लिए तैयार",
    "sec.frops":"फ़्रैंचाइज़ी अवसर","sec.chart":"इस हफ़्ते का चार्ट","sec.live":"थिएटरों में आपकी फ़िल्में",
    "sec.library":"लाइब्रेरी","sec.offers":"सौदों के प्रस्ताव","sec.series":"आपकी सीरीज़","sec.platforms":"प्लेटफ़ॉर्म",
    "sec.streamer":"🛰 आपका अपना स्ट्रीमर","sec.sports":"🏟 लाइव स्पोर्ट्स राइट्स","sec.invest":"स्टूडियो निवेश",
    "sec.execs":"👔 एग्ज़ीक्यूटिव सूट","sec.corp":"🏛 कॉर्पोरेट वित्त","sec.forecast":"🔮 12-सप्ताह कैश-फ़्लो पूर्वानुमान",
    "sec.feed":"इंडस्ट्री फ़ीड","sec.share":"मार्केट शेयर","sec.awards":"🏆 पुरस्कार सीज़न","sec.newfaces":"🌱 नए चेहरे",
    "stat.cash":"नकद राशि","stat.lastnet":"पिछले हफ़्ते का शुद्ध","stat.debt":"कर्ज़","stat.rep":"साख",
    "stat.catalog":"कैटलॉग मूल्य","stat.films":"रिलीज़्ड फ़िल्में","stat.ww":"कुल वर्ल्डवाइड ग्रॉस",
    "stat.subs":"सब्सक्राइबर","stat.credit":"क्रेडिट सीमा","stat.overhead":"ओवरहेड",
    "btn.greenlight":"🎥 ग्रीनलाइट","btn.pitch":"📡 पिच करें","btn.schedule":"📅 थिएट्रिकल रिलीज़",
    "btn.shop":"📺 स्ट्रीमर्स को दिखाएँ","btn.accept":"✅ स्वीकारें","btn.counter":"📈 काउंटर","btn.decline":"✕ ठुकराएँ",
    "btn.loan":"लोन लें","btn.repay":"चुकाएँ","btn.save":"सेव","btn.close":"बंद करें",
    "set.title":"⚙ सेटिंग्स","set.lang":"🌐 भाषा","set.font":"🔠 अक्षर आकार","set.auto":"ऑटो-प्ले सप्ताह",
    "set.saves":"💾 सेव निर्यात / आयात","set.export":"एक्सपोर्ट कोड कॉपी करें","set.import":"कोड आयात करें",
    "set.slot":"स्लॉट में सेव करें","set.menu":"🚪 स्टार्ट स्क्रीन पर वापस","set.on":"चालू","set.off":"बंद",
    "ach.title":"🏆 उपलब्धियाँ","ach.locked":"बंद",
    "sec.inhouse":"🧪 इन-हाउस ओरिजिनल्स","cs.stats":"📈 आँकड़े","cs.gear":"🎒 साज़-सामान","cs.story":"📜 कहानी",
    "pv.title":"🔒 गोपनीयता और आपका डेटा","pv.note":"सब कुछ इसी डिवाइस पर रहता है — न अकाउंट, न ट्रैकिंग।",
    "emp.how":"साम्राज्य कैसे काम करता है",
    "help.title":"❓ यहाँ फ़िल्म बिज़नेस कैसे चलता है",
  }
}

/* ── v28.9: Hindi number/date formatting ── */
const HI_MONTHS = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
function hiMonth(woy){
  if(LANG!=="hi") return null;
  /* week-of-year → month bucket (52 weeks ÷ 12) */
  return HI_MONTHS[Math.min(11, Math.floor((woy-1)/52*12))] || null;
}
function fmtHI(n){
  if(LANG!=="hi") return n;
  // Convert to Indian numbering system (lakhs/crores)
  const abs = Math.abs(n);
  if(abs >= 1e7) return (n/1e7).toFixed(2).replace(".", "॰") + " करोड़";
  if(abs >= 1e5) return (n/1e5).toFixed(2).replace(".", "॰") + " लाख";
  if(abs >= 1e3) return (n/1e3).toFixed(2).replace(".", "॰") + " हज़ार";
  return n.toString().replace(/\./g, "॰");
}
function fmtHIDate(d){
  if(LANG!=="hi") return d;
  const months = ["जनवरी","फरवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्टूबर","नवंबर","दिसंबर"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return day + " " + month + " " + year;
}
function fmtHIWeek(w){
  if(LANG!=="hi") return "W"+w;
  return "सप्ताह "+w;
}
function fmtHIMoney(n){
  if(LANG!=="hi") return n;
  // For money display in Hindi - use Indian numbering
  return "₹" + fmtHI(n) + (n>=1e7?" Cr":n>=1e5?" L":n>=1e3?" K":"");
}

/* Dynamic content translation helpers */
function tEvent(type, params={}){
  if(LANG!=="hi") return null;
  const events = {
    "film_release": "🎬 \""+params.title+"\" रिलीज़ हुई! ओपनिंग: "+fmtHIMoney(params.opening),
    "film_complete": "🎞 \""+params.title+"\" पूरी हुई! गुणवत्ता: "+params.quality+"/100",
    "franchise_created": "🏰 नई फ्रैंचाइज़ी: "+params.name,
    "milestone": "🏆 मील का पत्थर: "+params.type,
    "scandal": "📰 स्कैंडल: "+params.name,
    "award_nom": "🏆 नामांकन: "+params.title,
    "award_win": "🏆 पुरस्कार जीता: "+params.title,
    "streamer_launch": "🚀 स्ट्रीमर लॉन्च: "+params.name,
  };
  return events[params.type] || null;
}
function tNews(key, params={}){
  if(LANG!=="hi") return null;
  const news = {
    "rival_release": params.rival+" ने \""+params.title+"\" रिलीज़ की",
    "scandal": params.name+" विवाद में फंसे",
    "award": params.title+" ने पुरस्कार जीता",
  };
  return news[key] || null;
}

/* Export for use in other modules */
if(typeof module!=="undefined" && module.exports){
  module.exports = { t, setLang, LANG, fmtHI, fmtHIDate, fmtHIWeek, fmtHIMoney, tEvent, tNews };
};

let LANG = "en";
try{ LANG = localStorage.getItem("bow_lang")==="hi" ? "hi" : "en"; }catch(e){}
function t(key){
  const d = I18N[LANG]||I18N.en;
  return d[key] || I18N.en[key] || key;
}
function setLang(l){
  LANG = (l==="hi")? "hi":"en";
  try{ localStorage.setItem("bow_lang", LANG); }catch(e){}
  applyChromeLang();
}
/* translate static chrome (topbar, tabs, start screen) */
function applyChromeLang(){
  const set = (sel, key)=>{ const el=document.querySelector(sel); if(el) el.textContent=t(key); };
  document.querySelectorAll(".tab").forEach(b=>{ if(b.dataset.tab) b.textContent=t("tab."+b.dataset.tab); });
  document.querySelectorAll(".btab").forEach(b=>{
    if(!b.dataset.tab) return;
    const ic=b.querySelector("span"); const icHtml=ic? ic.outerHTML:"";
    b.innerHTML=icHtml+t("btab."+b.dataset.tab);
  });
  set("#btnWeek","btn.week"); set("#btnFast","btn.fast");
  const fl=document.querySelector("#fieldStudioName"); if(fl) fl.textContent=t("start.name");
  const fo=document.querySelector("#fieldOrigin"); if(fo) fo.textContent=t("start.origin");
  const fs=document.querySelector("#fieldScenario"); if(fs) fs.textContent=t("start.scenario");
  const fd=document.querySelector("#fieldDifficulty"); if(fd) fd.textContent=t("start.difficulty");
  set("#btnStart","start.found"); set("#btnContinue","start.continue");
  const nt=document.querySelector(".start-note"); if(nt) nt.textContent=t("start.note");
  document.title = LANG==="hi" ? "बॉक्स ऑफ़िस वॉर — मूवी व सीरीज़ स्टूडियो टाइकून" : "Box Office War — Movie & Series Studio Tycoon";
}
