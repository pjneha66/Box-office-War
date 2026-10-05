import fs from "fs";
import path from "path";

const cssPath = path.resolve("./style.css");
let css = fs.readFileSync(cssPath, "utf8");

// 1. Topbar: add safe-area-inset-top padding (already at line 224 for .topbar)
// The topbar already has: padding-top:max(0px, env(safe-area-inset-top));
// But we need to ensure it's on the .topbar element properly

// 2. Topbar-actions: reduce from 5-column to 3 visible + overflow scroll on mobile
// Find the @media(max-width:760px) block and modify .topbar-actions

// 3. Sub-12px fonts: ensure minimum 12px font size on mobile

// 4. Slider thumbs too small: increase min-height for btn-sm, btn-xs

// Let's apply these fixes by modifying the @media(max-width:760px) block

// Find the @media(max-width:760px) block (should be around line 551)
const media760Start = css.indexOf("@media(max-width:760px){");
if (media760Start === -1) {
  console.error("Could not find @media(max-width:760px)");
  process.exit(1);
}

// Find the end of this media block (next @media or end of file)
let braceCount = 0;
let mediaEnd = media760Start;
for (let i = media760Start; i < css.length; i++) {
  if (css[i] === '{') braceCount++;
  if (css[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      mediaEnd = i + 1;
      break;
    }
  }
}

const mediaBlock = css.slice(media760Start, mediaEnd);

// Replace the block with enhanced version
const newMediaBlock = `@media(max-width:760px){
  body{font-size:14.5px}
  .view{padding:12px 12px calc(124px + env(safe-area-inset-bottom))}
  .topbar-row{padding:8px 10px 6px; gap:6px}
  .brand{font-size:14px; max-width:38vw}
  .chip{font-size:11.5px; padding:4px 8px; min-height:28px}
  .chip-row{gap:4px}
  .topbar-actions{margin-left:auto; gap:5px; display:flex; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:60%; padding-bottom:4px; scrollbar-width:thin}
  .topbar-actions .btn{padding:8px 10px; min-height:40px; min-width:40px; flex-shrink:0}
  #btnWeek{min-height:44px; font-size:14.5px; flex:1; min-width:120px}
  #btnFast{min-height:40px; min-width:44px; padding:8px 10px; font-size:12.5px; font-weight:800; display:inline-flex; align-items:center; justify-content:center}
  .tabs{display:none}

  .bottomnav{
    display:flex; position:fixed; bottom:0; left:0; right:0; z-index:60;
    background:rgba(10,13,20,.96); backdrop-filter:blur(14px); border-top:1px solid var(--line2);
    box-shadow:0 -8px 30px rgba(0,0,0,.5);
    padding:4px 4px calc(4px + env(safe-area-inset-bottom));
  }
  .bottomnav::before{content:""; position:absolute; top:-1px; left:0; right:0; height:1px;
    background:linear-gradient(90deg, transparent, rgba(245,185,66,.4), transparent)}
  .btab{
    flex:1; background:none; border:none; color:var(--dim2); font-size:9.5px; font-weight:700; cursor:pointer;
    display:flex; flex-direction:column; gap:2px; align-items:center; padding:6px 2px; border-radius:10px;
    min-height:54px; position:relative; transition:color .2s;
  }
  .btab span{font-size:20px; transition:transform .25s var(--ease-spring)}
  .btab.active{color:var(--gold2)}
  .btab.active span{transform:translateY(-2px) scale(1.14); filter:drop-shadow(0 3px 10px rgba(245,185,66,.55))}
  .btab.active::before{
    content:""; position:absolute; top:0; left:24%; right:24%; height:2.5px; border-radius:0 0 4px 4px;
    background:linear-gradient(90deg, transparent, var(--gold), var(--gold2), transparent);
    box-shadow:0 2px 10px color-mix(in srgb, var(--gold) 55%, transparent);
  }

  .modal{max-height:93vh; border-radius:22px 22px 0 0; padding:18px 16px calc(18px + env(safe-area-inset-bottom)); overscroll-behavior:contain}
  .modal-head h3{font-size:19px}
  .modal-actions .btn{min-height:48px; font-size:15px}
  .pick-list{grid-template-columns:1fr; max-height:340px}
  .pick-list .card{padding:12px}
  .stat{padding:14px}
  .stat .s-v{font-size:19px}
  .stat-hero{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
  .chart-bar{grid-template-columns:22px minmax(0,1fr) auto}
  .chart-bar .cb-fill{font-size:10.5px; padding-right:6px}
  .plan-opt{padding:12px}
  .calendar-row{grid-template-columns:72px minmax(0,1fr); row-gap:6px}
  .calendar-row .tiny.muted:last-child{grid-column:1/-1; text-align:left}
  .toasts{left:10px; right:10px}
  .toast{max-width:100%; font-size:12.5px}
  .split{gap:10px}
  .section-title{font-size:12.5px; margin:22px 0 10px}
  .card{padding:15px}
  .card+.card{margin-top:12px}
  .btn{min-height:44px}
  .btn-sm{min-height:44px; font-size:13px; padding:7px 12px}
  .btn-xs{min-height:40px; font-size:12px; padding:4px 10px}
  .news-item{padding:11px 12px; font-size:13.5px}
  .talent-card .t-avatar{font-size:30px; width:48px}
  .cost-line{padding:7px 0; font-size:14px}
  .wk-cash{font-size:36px}
  .fab-week{display:block}

  /* Mobile P2: minimum font sizes */
  .tiny{font-size:12px !important}
  .small{font-size:12.5px !important}
  .muted{font-size:12px !important}
  button, select, input, textarea{font-size:12px !important}
}`;

// Replace the media block
const beforeMedia = css.slice(0, media760Start);
const afterMedia = css.slice(mediaEnd);
const newCss = beforeMedia + newMediaBlock + afterMedia.slice(afterMedia.indexOf('\n') + 1);

// Write the updated CSS
fs.writeFileSync(cssPath, newCss);
console.log("Applied Mobile P2 fixes to style.css");