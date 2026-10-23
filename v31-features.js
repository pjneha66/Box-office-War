/* ═══════════════════════════════════════════════════════════
   BOX OFFICE WAR — v31-features.js
   Restores the features the v28/v29 release notes promised but a
   past file restore dropped, and hardens the ones that survived:

   • talentAvatarSVG      — deterministic animated SVG portraits
   • renderBarChartSVG    — animated pure-SVG bar chart
   • renderPieChartSVG    — animated pure-SVG donut chart
   • boxOfficeAnalytics   — scope / top films / dom-intl / genre
   • color-blind cues     — ✓ ✕ ◆ ▲ ▼ glyphs (Settings toggle)
   • PWA install card     — real beforeinstallprompt button
   • what-if share links  — #wif=... URL carrying the fork numbers
   • hqFloorPlanSVG       — lot map that lights up as you build
   • NAV_GROUPS/TAB_META  — data-driven nav + sub-tabs

   Classic script: shares the global scope with ui.js/engine.js.
   Everything here is only *called* at render time, so referencing
   ui.js helpers (esc, fmtM, statCard, render…) from function bodies
   is safe regardless of load order.
   ═══════════════════════════════════════════════════════════ */

/* ── deterministic seed helpers ── */
function v31Hash(s){
  let h = 2166136261 >>> 0;
  s = String(s);
  for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function v31Pick(arr, seed){ return arr[Math.abs(seed) % arr.length]; }

const AV_SKINS   = ["#f3cfae","#eab98d","#dba571","#c68a52","#a96e3c","#8a5730","#6f4526","#f7d7bb"];
const AV_HAIRS   = ["#1d1a17","#3b2a1d","#5a3d24","#8a6a3f","#b08a4e","#c9c9c9","#7a2e2e","#2e2e3a"];
const AV_ROLE_COLOR = { actor:"#f5b942", director:"#b28fce", writer:"#4dd6e8", producer:"#7ee787" };

/* ═══════════════════════════════════════════════════════════
   ANIMATED SVG PORTRAITS
   One deterministic portrait per talent, seeded from id + name +
   kind so the same face always comes back. CSS-only animation:
   idle bob, blink, hair drift, aura pulse + one flourish per
   archetype (actor waves, writer writes, director claps,
   producer checks the clipboard).
   ═══════════════════════════════════════════════════════════ */
const AV_PIXEL_SPRITES = [
  "assets/itch-avatars/Avatars_01.png",
  "assets/itch-avatars/Avatars_02.png",
  "assets/itch-avatars/Avatars_03.png",
  "assets/itch-avatars/Avatars_04.png",
  "assets/itch-avatars/Avatars_05.png",
  "assets/itch-avatars/Avatars_06.png",
  "assets/itch-avatars/Avatars_07.png",
  "assets/itch-avatars/Avatars_08.png",
  "assets/itch-avatars/Avatars_09.png",
  "assets/itch-avatars/Avatars_10.png",
  "assets/itch-avatars/Avatars_11.png",
  "assets/itch-avatars/Avatars_12.png",
  "assets/itch-avatars/Avatars_13.png",
  "assets/itch-avatars/Avatars_14.png",
  "assets/itch-avatars/Avatars_15.png",
  "assets/itch-avatars/Avatars_16.png",
  "assets/itch-avatars/Avatars_17.png",
  "assets/itch-avatars/Avatars_18.png",
  "assets/itch-avatars/Avatars_19.png",
  "assets/itch-avatars/Avatars_20.png",
  "assets/itch-avatars/Avatars_21.png",
  "assets/itch-avatars/Avatars_22.png",
  "assets/itch-avatars/Avatars_23.png",
  "assets/itch-avatars/Avatars_24.png",
  "assets/itch-avatars/Avatars_25.png",
  "assets/pixel-characters/char-female-1.png",
  "assets/pixel-characters/char-male-1.png",
  "assets/pixel-characters/char-female-2.png",
  "assets/pixel-characters/char-male-2.png",
  "assets/pixel-characters/char-female-cheer.png",
  "assets/pixel-characters/char-male-cheer.png",
  "assets/pixel-characters/char-robot.png",
  "assets/pixel-characters/char-zombie.png"
];

function talentAvatarSVG(t, opts){
  opts = opts || {};
  const seed = v31Hash((t.id!=null?t.id:"") + "|" + (t.name||"") + "|" + (t.kind||""));
  const kind = t.kind || "actor";
  const roleColor = AV_ROLE_COLOR[kind] || "#c9ccd1";
  
  let pool = AV_PIXEL_SPRITES;
  if(kind === "actor"){
    pool = AV_PIXEL_SPRITES.slice(0, 10).concat(AV_PIXEL_SPRITES.slice(25, 29));
  } else if(kind === "director"){
    pool = AV_PIXEL_SPRITES.slice(8, 16);
  } else if(kind === "writer"){
    pool = AV_PIXEL_SPRITES.slice(14, 21);
  } else if(kind === "producer"){
    pool = AV_PIXEL_SPRITES.slice(19, 25).concat(AV_PIXEL_SPRITES.slice(31, 33));
  }
  const sprite = v31Pick(pool, seed);
  const size = opts.size || 52;

  return `<div class="itch-avatar" style="width:${size}px;height:${size}px;border-color:${roleColor};" title="${esc(t.name||"talent")}">`+
    `<img src="${sprite}" alt="${esc(t.name||"character")}" style="width:100%;height:100%;object-fit:contain;image-rendering:pixelated;image-rendering:crisp-edges">`+
  `</div>`;
}

/* ═══════════════════════════════════════════════════════════
   ANIMATED SVG CHARTS — no chart library, no deps
   ═══════════════════════════════════════════════════════════ */
function renderBarChartSVG(data, opts){
  opts = opts || {};
  const w = opts.width || 340, h = opts.height || 150, pad = 18;
  const items = (data || []).slice(0, opts.max || 8);
  if(!items.length) return "<div class='tiny muted'>No data yet.</div>";
  const max = Math.max(1, ...items.map(d => d.value || 0));
  const fmt = opts.fmt || (v => v);
  const bw = (w - pad*2) / items.length;
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="display:block" class="chart-svg" role="img" aria-label="${esc(opts.aria || "bar chart")}">`;
  for(let i=1;i<=3;i++){
    const y = h - pad - (h - pad*2) * i/3;
    s += `<line x1="${pad}" y1="${y.toFixed(1)}" x2="${w-pad}" y2="${y.toFixed(1)}" stroke="var(--line2)" stroke-width="1" stroke-dasharray="3 4"/>`;
  }
  items.forEach((d, i) => {
    const bh = (d.value / max) * (h - pad*2);
    const x = pad + i*bw + bw*0.15, y = h - pad - bh, bwid = bw*0.7;
    const col = d.color || "var(--gold)";
    s += `<rect class="ch-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bwid.toFixed(1)}" height="${Math.max(1,bh).toFixed(1)}" rx="3" fill="${col}" style="animation-delay:${i*70}ms"><title>${esc(d.label)}: ${esc(fmt(d.value))}</title></rect>`;
    if(bh > 14) s += `<text x="${(x+bwid/2).toFixed(1)}" y="${(y-3).toFixed(1)}" text-anchor="middle" font-size="9" fill="var(--text)">${esc(fmt(d.value))}</text>`;
    const lbl = String(d.label).length > 10 ? String(d.label).slice(0,9) + "…" : String(d.label);
    s += `<text x="${(x+bwid/2).toFixed(1)}" y="${h-pad+11}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${esc(lbl)}</text>`;
  });
  return s + "</svg>";
}

const AV_PALETTE = ["#f5b942","#4dd6e8","#b28fce","#7ee787","#f09199","#8ab4ff","#ffd479","#c9ccd1"];

function renderPieChartSVG(slices, opts){
  opts = opts || {};
  const size = opts.size || 150;
  const total = (slices || []).reduce((a, s) => a + (s.value || 0), 0);
  if(!total) return "<div class='tiny muted'>No data yet.</div>";
  const r = size*0.36, cx = size/2, cy = size/2, stroke = size*0.22, circ = 2*Math.PI*r;
  let acc = 0;
  let out = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="chart-svg" style="transform:rotate(-90deg);display:block;margin:0 auto" role="img" aria-label="${esc(opts.aria || "pie chart")}">`;
  slices.forEach((s, i) => {
    const pct = (s.value || 0) / total;
    const dash = pct*circ, gap = circ - dash, off = -acc*circ;
    out += `<circle class="ch-slice" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color || AV_PALETTE[i % AV_PALETTE.length]}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(1)} ${gap.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" style="animation-delay:${i*90}ms"><title>${esc(s.label)}: ${Math.round(pct*100)}%</title></circle>`;
    acc += pct;
  });
  return out + "</svg>";
}

/* ═══════════════════════════════════════════════════════════
   BOX OFFICE ANALYTICS — scope filter, top films, dom/intl, genre
   State is module-level; the chip clicks are delegated so the
   block never needs a bindView() hook.
   ═══════════════════════════════════════════════════════════ */
let BO_SCOPE = "all";
function boxOfficeAnalytics(){
  const films = (G.films || []).filter(f => (f.ww || 0) > 0);
  if(!films.length) return "";
  const scoped = BO_SCOPE === "year" ? films.filter(f => f.year === yearOf(G.week)) : films;
  if(!scoped.length) return "";
  const totalWW  = scoped.reduce((a,f) => a + (f.ww || 0), 0);
  const totalDom = scoped.reduce((a,f) => a + (f.dom || 0), 0);
  const totalIntl= Math.max(0, totalWW - totalDom);
  const byGenre = {};
  scoped.forEach(f => { byGenre[f.genre] = (byGenre[f.genre] || 0) + (f.ww || 0); });
  const genreRows = Object.keys(byGenre)
    .map((g, i) => ({ label: (DATA.GENRES[g] || {name:g}).name, value: byGenre[g], color: AV_PALETTE[i % AV_PALETTE.length] }))
    .sort((a,b) => b.value - a.value);
  const top = [...scoped].sort((a,b) => (b.ww||0) - (a.ww||0)).slice(0, 8)
    .map(f => ({ label: f.title, value: Math.round(f.ww || 0), color: "var(--gold)" }));
  return "<div class='section-title'>📊 Box office analytics</div>"+
    "<div class='card'><div class='row' style='gap:6px;margin-bottom:8px'>"+
      [["all","All-time"],["year","Year "+yearOf(G.week)]].map(x =>
        "<button class='btn btn-sm "+(BO_SCOPE===x[0]?"btn-primary":"btn-alt")+"' data-boascope='"+x[0]+"'>"+x[1]+"</button>").join("")+
    "</div>"+
    "<div class='stat-hero' style='margin-bottom:10px'>"+
      statCard(fmtG(totalWW), "Gross ("+(BO_SCOPE==="year"?"Y"+yearOf(G.week):"all-time")+")")+
      statCard(fmtG(totalDom), "Domestic")+
      statCard(fmtG(totalIntl), "International")+
      statCard(scoped.length, "Films")+
    "</div>"+
    "<div class='grid g2'>"+
      "<div><b class='small'>Top films by gross</b>"+renderBarChartSVG(top, {aria:"top films by gross", fmt:v=>fmtG(v), width:340, height:150})+"</div>"+
      "<div style='text-align:center'><b class='small'>Domestic vs international</b>"+
        renderPieChartSVG([{label:"Domestic",value:totalDom,color:"var(--gold)"},{label:"International",value:totalIntl,color:"#4dd6e8"}], {size:150, aria:"domestic vs international"})+
        "<div class='tiny muted'>🌐 "+Math.round(totalIntl/Math.max(1,totalWW)*100)+"% international</div></div>"+
    "</div>"+
    "<div style='margin-top:10px'><b class='small'>Gross by genre</b>"+
      renderBarChartSVG(genreRows.slice(0,8), {aria:"gross by genre", fmt:v=>fmtG(v), width:340, height:150})+"</div>"+
    "</div>";
}
document.addEventListener("click", function(e){
  const b = e.target && e.target.closest ? e.target.closest("[data-boascope]") : null;
  if(b && typeof render === "function"){
    BO_SCOPE = b.getAttribute("data-boascope") || "all";
    if(typeof beep === "function") beep("click");
    render();
  }
});

/* ═══════════════════════════════════════════════════════════
   COLOR-BLIND CUES — glyphs so hue is never the only signal.
   State + applier live in ui.js (CB_CUES / applyCbCues, applied at
   boot); this is just the setter the Settings toggle calls.
   Default ON. ═══════════════════════════════════════════════════════ */
function setCB(v){
  CB_CUES = !!v;
  try{ localStorage.setItem("bow_cb", CB_CUES ? "1" : "0"); }catch(e){}
  if(typeof applyCbCues === "function") applyCbCues();
}

/* ═══════════════════════════════════════════════════════════
   PWA INSTALL CARD — uses the captured beforeinstallprompt event
   (captured in index.html) for a one-tap install.
   ═══════════════════════════════════════════════════════════ */
function pwaInstallCardHTML(){
  let standalone = false;
  try{ standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches; }catch(e){}
  const hasPrompt = !!window.__bowInstallPrompt;
  return "<div class='card'><div class='spread'><b>📲 Install as app</b>"+
    (standalone ? "<span class='tag green'>✓ running as app</span>" : "")+"</div>"+
    "<div class='tiny muted' style='margin-top:4px'>"+
    (standalone ? "You're already running the installed app — launches straight from your home screen, works offline."
                : hasPrompt ? "One tap puts Box Office War on your home screen: full screen, offline, no app store, no account."
                            : "Use your browser menu → “Add to Home Screen” / “Install app”. Chrome, Edge, Safari and Android browsers all support it — and it plays offline afterwards.")+
    "</div>"+
    (hasPrompt ? "<button class='btn btn-sm btn-primary' id='btnPwaInstall' style='margin-top:8px'>📲 Install now</button>" : "")+
    "</div>";
}
function bindPWAInstall(v){
  const b = v.querySelector("#btnPwaInstall");
  if(!b) return;
  b.onclick = async function(){
    const p = window.__bowInstallPrompt;
    if(!p){ toast("Install prompt isn't available right now — use your browser menu → Add to Home Screen.", "bad"); return; }
    b.disabled = true; b.textContent = "⏳ Waiting…";
    try{
      p.prompt();
      const r = await p.userChoice;
      if(r && r.outcome === "accepted") toast("📲 Installing — check your home screen in a moment.", "good");
      else { b.disabled = false; b.textContent = "📲 Install now"; }
    }catch(e){ b.disabled = false; b.textContent = "📲 Install now"; }
    window.__bowInstallPrompt = null;
  };
}

/* ═══════════════════════════════════════════════════════════
   WHAT-IF SHARE LINKS — the fork parameters ride in the URL
   hash (#wif=base64url), never the save.
   ═══════════════════════════════════════════════════════════ */
function whatIfShareURL(scenId){
  const dated = G.projects.filter(p => p.kind==="film" && p.phase==="ready" && p.releaseWeek > G.week)[0];
  const payload = {
    s: scenId, w: 16, f: dated ? dated.id : null, t: G.week,
    c: Math.round((G.studio.cash||0) * 10) / 10,
    g: Math.round((G.stats.totalWW||0) * 10) / 10,
    r: Math.round((G.studio.rep||0) * 10) / 10,
  };
  let enc;
  try{
    enc = btoa(encodeURIComponent(JSON.stringify(payload)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }catch(e){ return ""; }
  try{ return location.origin + location.pathname + "#wif=" + enc; }
  catch(e){ return ""; }
}
function whatIfShareCopy(scenId){
  const url = whatIfShareURL(scenId);
  if(!url){ toast("Couldn't build a share link.", "bad"); return; }
  const done = () => toast("🔗 Share link copied — it carries the what-if numbers, not your save.", "good");
  const fallback = () => {
    try{
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }catch(e){}
  };
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(url).then(done).catch(() => { fallback(); done(); });
  else { fallback(); done(); }
}
/* boot: a shared link preloads the sandbox run */
(function whatIfBoot(){
  try{
    const m = (location.hash || "").match(/^#wif=([A-Za-z0-9\-_]+)$/);
    if(!m) return;
    const json = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(decodeURIComponent(json));
    if(p && p.s) window.__bowPendingWhatIf = p;
  }catch(e){}
})();

/* ═══════════════════════════════════════════════════════════
   HQ FLOOR PLAN — the lot as a building map; wings light up
   as you buy them (dark = unbuilt, gold = partial, green = live).
   ═══════════════════════════════════════════════════════════ */
function hqFloorPlanSVG(){
  let depts = [];
  try{ depts = hqDepts() || []; }catch(e){ return ""; }
  if(!depts.length) return "";
  const cols = 4, cw = 150, ch = 84, gap = 8, pad = 10;
  const rows = Math.ceil(depts.length / cols);
  const W = pad*2 + cols*cw + (cols-1)*gap, H = pad*2 + rows*ch + (rows-1)*gap;
  let lit = 0, total = 0;
  const cells = depts.map((d, i) => {
    const items = d.items || [];
    total += items.length;
    const owned = items.filter(it =>
      it.kind === "hq"   ? hqOwned(it.id) :
      it.kind === "exec" ? !!(G.execs && G.execs[it.id]) :
                           !!(G.upgrades && G.upgrades[it.id]));
    lit += owned.length;
    const full = items.length > 0 && owned.length === items.length;
    const x = pad + (i % cols) * (cw + gap), y = pad + Math.floor(i / cols) * (ch + gap);
    const stroke = full ? "#7ee787" : owned.length ? "#f5b942" : "#3a4257";
    return `<g>`+
      `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="8" fill="${owned.length ? "#7ee787" : "#1a2130"}" fill-opacity="${full ? .22 : owned.length ? .12 : .55}" stroke="${stroke}" stroke-width="1.5"`+
      (owned.length ? ` style="filter:drop-shadow(0 0 5px ${stroke})"` : "") + `/>`+
      `<text x="${x+10}" y="${y+23}" font-size="13" fill="var(--text)">${d.icon||""} ${esc(d.name)}</text>`+
      `<text x="${x+10}" y="${y+43}" font-size="10" fill="var(--muted)">${owned.length}/${items.length} live</text>`+
      `<text x="${x+10}" y="${y+61}" font-size="9" fill="var(--muted)">${items.map(it => esc(String(it.name).split(" ")[0])).join(" · ")}</text>`+
      (full ? `<text x="${x+cw-10}" y="${y+23}" font-size="13" fill="#7ee787" text-anchor="end">✓</text>` : "")+
    `</g>`;
  }).join("");
  return `<div class='card'><div class='spread'><b>🏢 HQ floor plan</b>`+
    `<span class='tag ${lit===total && total ? "green" : lit ? "gold" : ""}'>${lit}/${total} equipped</span></div>`+
    `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin-top:8px" role="img" aria-label="HQ floor plan">${cells}</svg>`+
    `<div class='tiny muted' style='margin-top:4px'>Dark wings are unbuilt · gold = partially equipped · green + glow = fully live. Buy wings in the HQ board below.</div></div>`;
}

/* ═══════════════════════════════════════════════════════════
   DATA-DRIVEN NAVIGATION — single source of truth for the
   mobile groups and every section's sub-tabs.
   ═══════════════════════════════════════════════════════════ */
const NAV_GROUPS = [
  { id:"home",   icon:"", label:"Home",   tabs:["dashboard"] },
  { id:"studio", icon:"", label:"Studio", tabs:["studio"] },
  { id:"create", icon:"", label:"Create", tabs:["develop","productions"] },
  { id:"market", icon:"", label:"Market", tabs:["boxoffice","fans","ott","live"] },
  { id:"more",   icon:"", label:"More",   tabs:["empire","library","games","finance","notifications"] },
];
const TAB_META = {
  dashboard:   [["overview","Command deck"],["actions","Management desks"],["slate","Project tracker"],["macro","Industry pulse"]],
  studio:      [["lot","Campus"],["csuite","Leadership"],["board","Strategy"],["operations","Workforce"],["crisis","Reputation"],["heritage","Legacy"]],
  develop:     [["scripts","Scripts"],["demographics","Audience lab"],["creativity","Craft & vault"],["ip","Rights market"],["talent","Talent desk"],["combos","Combos codex"],["tax","Locations & partners"]],
  productions: [["all","All"],["pre","Pre"],["shoot","Shoot"],["post","Post"],["ready","Ready"],["dated","Dated"]],
  boxoffice:   [["chart","Theatrical chart"],["chains","Mega-chains"],["plf","PLF & concessions"],["blitz","Marketing blitz"],["territories","Territory deals"],["awards","Awards circuit"],["clash","Clash radar"]],
  fans:        [["all","All"],["mail","Mail"],["trending","Trending"],["viral","Viral"]],
  ott:         [["home","Home"],["originals","Originals"],["deals","Deals"],["sports","Sports"],["market","Market"]],
  live:        [["linear","Linear Channels"],["stream","Live Stream Hub"],["events","Live Events"],["studio","Host Studio"]],
  library:     [["films","Films"],["series","Series"],["physical","Physical 4K Media"],["vault","Restoration Vault"]],
  empire:      [["franchises","Franchises"],["music","Music"],["games","Games"],["comics","Comics"]],
  games:       [["dev","In Dev"],["released","Released"],["hardware","Hardware Platforms"],["greenlight","Greenlight"]],
};
/* which live filter var holds the active sub-tab per section — read as
   functions so the strip always highlights what the view is showing */
const TAB_SUB_ACTIVE = {
  dashboard:   ()=>(typeof DASHBOARD_SUB!=="undefined"?DASHBOARD_SUB:"overview"),
  studio:      ()=>(typeof STUDIO_SUB!=="undefined"?STUDIO_SUB:"lot"),
  develop:     ()=>DEVELOP_SUB||"scripts",
  productions: ()=>PROD_FILTER||"all",
  boxoffice:   ()=>(typeof BOXOFFICE_SUB!=="undefined"?BOXOFFICE_SUB:"chart"),
  fans:        ()=>FAN_MAIL_FILTER||"all",
  ott:         ()=>OTT_SUB||"home",
  live:        ()=>(G.live?(G.live.activeSub||G.live.subTab||"linear"):"linear"),
  library:     ()=>(typeof LIBRARY_SUB!=="undefined"?LIBRARY_SUB:"films"),
  empire:      ()=>(typeof EMPIRE_SUB!=="undefined"?EMPIRE_SUB:"franchises"),
  games:       ()=>(typeof GAMES_SUB!=="undefined"?GAMES_SUB:"dev"),
};
/* which data-* attribute each section's chips carry */
const TAB_SUB_ATTR = {
  dashboard:   "data-dashsub",
  studio:      "data-studiosub",
  develop:     "data-devsub",
  productions: "data-filter-prod",
  boxoffice:   "data-bosub",
  fans:        "data-fanfilter",
  ott:         "data-ottsub",
  live:        "data-livesub",
  library:     "data-libsub",
  empire:      "data-empiretab",
  games:       "data-gamestab",
};
const TAB_SUB_DEFAULT = {
  dashboard:   "overview",
  studio:      "lot",
  develop:     "scripts",
  productions: "all",
  boxoffice:   "chart",
  fans:        "all",
  ott:         "home",
  live:        "linear",
  library:     "films",
  empire:      "franchises",
  games:       "dev",
};
const TAB_SUB_GHOST = { productions:1, fans:1 }; /* inactive chips used btn-ghost here */

