/* Builds a self-contained visual harness page (all CSS/JS inlined) so the
   headless Chromium in this sandbox can render the game without navigation. */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

function build(opts) {
  opts = opts || {};
  const overrides = opts.overrides || {};
  let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // inline stylesheets
  html = html.replace(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?">/g, (m, file) => {
    const css = fs.readFileSync(overrides[file] || path.join(ROOT, file), "utf8");
    return `<style data-src="${file}">${css}</style>`;
  });
  // inline scripts
  html = html.replace(/<script src="([^"?]+)(?:\?[^"]*)?"><\/script>/g, (m, file) => {
    const js = fs.readFileSync(path.join(ROOT, file), "utf8");
    return `<script data-src="${file}">${js}</script>`;
  });
  // strip service worker + apk update blocks (network/capability dependent)
  html = html.replace(/<script>\s*\/\* PWA[^]*?<\/script>/g, "");
  html = html.replace(/<script>\s*\/\* ═══ APK update check[^]*?<\/script>/g, "");
  const shim = '<script>(function(){try{localStorage.setItem("__t","1");localStorage.removeItem("__t");}catch(e){var m={};var api={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};},key:function(i){return Object.keys(m)[i]||null;},get length(){return Object.keys(m).length;}};Object.defineProperty(window,"localStorage",{configurable:true,value:api});}})();<\/script>';
  html = html.replace("<head>", '<head><base href="file://' + ROOT + '/">' + shim);
  return html;
}

module.exports = { build };
if (require.main === module) {
  const out = path.join(ROOT, ".harness.html");
  fs.writeFileSync(out, build());
  console.log("wrote", out, fs.statSync(out).size, "bytes");
}
