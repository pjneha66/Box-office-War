/* Box office chart kit — inline SVG, no dependencies.
   The desk used to draw its "charts" as a row of <div>s with inline heights:
   no axis, no scale, no labels, and nothing readable on a phone. Everything
   here shares one scale helper so a gross of $34.3M looks the same in the run
   card, the dossier and the reviews dialog. Colours come from the command-deck
   tokens: gold for money, teal for international, muted for context. */
(function (global) {
  "use strict";

  var C = {
    gold: "#edc47c",
    cream: "#f2edda",
    teal: "#7fb3a2",
    muted: "#93a692",
    grid: "#2c4038",
    line: "#4e6355",
    bad: "#e09a86"
  };
  var uid = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* $34.3M / $612K / $1.2B — the same grammar the rest of the game uses. */
  function money(v) {
    var n = Math.abs(Number(v) || 0);
    var sign = (Number(v) || 0) < 0 ? "-" : "";
    if (n >= 1000) return sign + "$" + (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "B";
    if (n >= 1) return sign + "$" + n.toFixed(n >= 100 ? 0 : 1).replace(/\.0$/, "") + "M";
    return sign + "$" + Math.round(n * 1000) + "K";
  }

  /* Round the scale up to something a human would put on an axis. */
  function niceMax(v) {
    var n = Math.max(0.0001, Number(v) || 0);
    var pow = Math.pow(10, Math.floor(Math.log(n) / Math.LN10));
    var f = n / pow;
    var step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return step * pow;
  }

  function labelEvery(n, maxLabels) {
    if (n <= maxLabels) return 1;
    return Math.ceil(n / maxLabels);
  }

  /* Area + line: the weekly gross curve of a run. */
  function area(points, opts) {
    opts = opts || {};
    points = (points || []).filter(function (p) { return p && isFinite(p.value); });
    if (!points.length) return "";
    var compact = !!opts.compact;
    var w = compact ? 380 : 640, h = opts.height || (compact ? 160 : 190);
    var pad = compact ? { t: 12, r: 10, b: 24, l: 44 } : { t: 14, r: 16, b: 26, l: 54 };
    var fs = compact ? 10 : 9;
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var max = niceMax(Math.max.apply(null, points.map(function (p) { return Math.max(0, p.value); })));
    var step = points.length > 1 ? iw / (points.length - 1) : 0;
    var x = function (i) { return points.length > 1 ? pad.l + i * step : pad.l + iw / 2; };
    var y = function (v) { return pad.t + ih - (Math.max(0, v) / max) * ih; };
    var id = "boArea" + (++uid);
    var grid = "", ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var gv = (max / ticks) * g, gy = y(gv);
      grid += '<line x1="' + pad.l + '" y1="' + gy.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + gy.toFixed(1) + '" stroke="' + (g === 0 ? C.line : C.grid) + '" stroke-width="1"/>' +
        '<text x="' + (pad.l - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="' + C.muted + '" font-size="' + fs + '" font-family="ui-monospace,monospace">' + esc(opts.format ? opts.format(gv) : money(gv)) + "</text>";
    }
    var line = points.map(function (p, i) { return x(i).toFixed(1) + "," + y(p.value).toFixed(1); }).join(" ");
    var base = (pad.t + ih).toFixed(1);
    var fill = x(0).toFixed(1) + "," + base + " " + line + " " + x(points.length - 1).toFixed(1) + "," + base;
    var every = labelEvery(points.length, opts.maxLabels || (compact ? 4 : 8));
    var xlabels = points.map(function (p, i) {
      if (i % every !== 0 && i !== points.length - 1) return "";
      return '<text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" text-anchor="middle" fill="' + C.muted + '" font-size="' + fs + '" font-family="ui-monospace,monospace">' + esc(p.label) + "</text>";
    }).join("");
    var dots = points.length <= 14 ? points.map(function (p, i) {
      return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.value).toFixed(1) + '" r="2.6" fill="#14251e" stroke="' + C.gold + '" stroke-width="1.4"><title>' + esc(p.label + " · " + (opts.format ? opts.format(p.value) : money(p.value)) + (p.note ? " · " + p.note : "")) + "</title></circle>";
    }).join("") : "";
    return '<svg class="bo-chart-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "Weekly gross trend") + '" preserveAspectRatio="xMidYMid meet">' +
      "<defs><linearGradient id=\"" + id + "\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">" +
      '<stop offset="0%" stop-color="' + C.gold + '" stop-opacity=".26"/><stop offset="100%" stop-color="' + C.gold + '" stop-opacity="0"/>' +
      "</linearGradient></defs>" + grid +
      '<polygon points="' + fill + '" fill="url(#' + id + ')"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + C.gold + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      dots + xlabels + "</svg>";
  }

  /* Vertical bars: opening-weekend days, score buckets, small comparisons. */
  function bars(points, opts) {
    opts = opts || {};
    points = (points || []).filter(function (p) { return p && isFinite(p.value); });
    if (!points.length) return "";
    var compact = !!opts.compact;
    var w = compact ? 380 : 640, h = opts.height || (compact ? 150 : 180);
    var pad = compact ? { t: 18, r: 10, b: 24, l: 40 } : { t: 20, r: 14, b: 28, l: 46 };
    var fs = compact ? 10 : 9;
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var max = niceMax(Math.max.apply(null, points.map(function (p) { return Math.max(0, p.value); })));
    var slot = iw / points.length;
    var bw = Math.min(opts.barWidth || 54, slot * 0.58);
    var grid = "";
    for (var g = 0; g <= 4; g++) {
      var gv = (max / 4) * g, gy = pad.t + ih - (gv / max) * ih;
      grid += '<line x1="' + pad.l + '" y1="' + gy.toFixed(1) + '" x2="' + (w - pad.r) + '" y2="' + gy.toFixed(1) + '" stroke="' + (g === 0 ? C.line : C.grid) + '" stroke-width="1"/>' +
        '<text x="' + (pad.l - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="' + C.muted + '" font-size="' + fs + '" font-family="ui-monospace,monospace">' + esc(opts.format ? opts.format(gv) : money(gv)) + "</text>";
    }
    var out = points.map(function (p, i) {
      var cx = pad.l + slot * i + slot / 2;
      var bh = Math.max(2, (Math.max(0, p.value) / max) * ih);
      var by = pad.t + ih - bh;
      var tone = p.tone === "teal" ? C.teal : p.tone === "bad" ? C.bad : C.gold;
      return '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2" fill="' + tone + '" fill-opacity="' + (p.muted ? ".45" : ".85") + '"><title>' + esc(p.label + " · " + (opts.format ? opts.format(p.value) : money(p.value))) + "</title></rect>" +
        '<text x="' + cx.toFixed(1) + '" y="' + (by - 6).toFixed(1) + '" text-anchor="middle" fill="' + C.cream + '" font-size="' + (compact ? 10.5 : 9.5) + '" font-family="ui-monospace,monospace">' + esc(opts.format ? opts.format(p.value) : money(p.value)) + "</text>" +
        '<text x="' + cx.toFixed(1) + '" y="' + (h - 9) + '" text-anchor="middle" fill="' + C.muted + '" font-size="' + fs + '" font-family="ui-monospace,monospace">' + esc(p.label) + "</text>";
    }).join("");
    return '<svg class="bo-chart-svg" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="' + esc(opts.aria || "Comparison chart") + '" preserveAspectRatio="xMidYMid meet">' + grid + out + "</svg>";
  }

  /* Stacked proportion bar with a legend: domestic vs international, review mix. */
  function split(parts, opts) {
    opts = opts || {};
    parts = (parts || []).filter(function (p) { return p && p.value > 0; });
    if (!parts.length) return "";
    var total = parts.reduce(function (a, p) { return a + p.value; }, 0) || 1;
    var segs = parts.map(function (p, i) {
      var pct = (p.value / total) * 100;
      var tone = p.tone === "teal" ? C.teal : p.tone === "bad" ? C.bad : p.tone === "muted" ? C.grid : C.gold;
      return '<i class="bo-split-seg" style="width:' + pct.toFixed(2) + "%;background:" + tone + '" title="' + esc(p.label + " · " + (opts.format ? opts.format(p.value) : money(p.value)) + " (" + Math.round(pct) + "%)") + '"></i>';
    }).join("");
    var legend = parts.map(function (p) {
      var pct = Math.round((p.value / total) * 100);
      return '<span class="bo-legend-item"><i style="background:' + (p.tone === "teal" ? C.teal : p.tone === "bad" ? C.bad : p.tone === "muted" ? C.grid : C.gold) + '"></i>' + esc(p.label) + " <b>" + esc(opts.format ? opts.format(p.value) : money(p.value)) + "</b> <small>" + pct + "%</small></span>";
    }).join("");
    return '<div class="bo-split"><div class="bo-split-bar">' + segs + '</div><div class="bo-legend">' + legend + "</div></div>";
  }

  global.BOCharts = { area: area, bars: bars, split: split, money: money, niceMax: niceMax, colors: C };
})(typeof window !== "undefined" ? window : globalThis);
