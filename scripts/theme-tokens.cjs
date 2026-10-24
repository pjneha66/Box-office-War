/* Build step: lift the management-deck palette into CSS custom properties.
   Every colour literal in command-deck.css becomes a `--cd-t<hex>` token whose
   :root default is the literal itself, so the classic deck renders pixel-for-
   pixel the same. A role map (one rule, mode-agnostic) then lets any theme
   drive the deck from its own --bg/--card/--line/--text/--gold tokens.
   Run: node scripts/theme-tokens.cjs  (idempotent) */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const DECK = path.join(ROOT, "command-deck.css");
const THEME_CSS = path.join(ROOT, "theme-studio.css");
const START = "/* ==== AUTO-GENERATED DECK ROLE MAP (scripts/theme-tokens.cjs) ==== */";
const END = "/* ==== END AUTO-GENERATED DECK ROLE MAP ==== */";

const HEX = /#[0-9a-fA-F]{6}\b(?![0-9a-fA-F])/g;
const HEX8 = /#([0-9a-fA-F]{6})([0-9a-fA-F]{2})\b/g;

function toRgb(hex) {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function toHsl(hex) {
  const [r, g, b] = toRgb(hex);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}
function luma(hex) {
  const [r, g, b] = toRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Paper surfaces, identified by context in command-deck.css: the brief card,
   the guide's reading pane and the search field printed on it. */
/* only hexes used solely as a painted sheet: #f6f0d9 and #fdf6e3
   are text colours on dark panels, so they resolve through the ink ramp */
const PAPER_BG = new Set(["#e8d9b9", "#e9dfc6", "#f4eedc"]);
const PAPER_INK = new Set(["#263732", "#293d31", "#52624b", "#687452", "#87936a", "#6e6044", "#99a183", "#b8bda2"]);
const PAPER_INK_MUTED = new Set(["#52624b", "#687452", "#87936a", "#99a183", "#b8bda2", "#6e6044"]);

function roleOf(hex) {
  const low = hex.toLowerCase();
  if (PAPER_BG.has(low)) return "paper";
  if (PAPER_INK.has(low)) return PAPER_INK_MUTED.has(low) ? "paperInkMuted" : "paperInk";
  const [h, s, l] = toHsl(low);
  const L = luma(low);
  /* semantic families stay semantic: the deck's own hit/flop/info colours */
  if (s >= 0.40 && (h < 22 || h > 338) && L > 0.40) return "danger";
  if (s >= 0.30 && h >= 80 && h <= 155 && L > 0.55) return "success";
  if (s >= 0.25 && h >= 190 && h <= 235 && L > 0.55) return "info";
  if (s >= 0.25 && h >= 250 && h <= 295 && L > 0.55) return "purple";
  /* warm near-white creams are body text, not accent highlights */
  if (L >= 0.86 && h >= 28 && h <= 62 && s < 0.72) return "ink0";
  /* accent ramp: warm hues with enough saturation */
  if (h >= 24 && h <= 62 && s >= 0.28) {
    if (L >= 0.78) return "accentHi";
    if (L >= 0.60) return "accent";
    if (L >= 0.40) return "accentDim";
    return "accentDeep";
  }
  if (L >= 0.90) return "ink0";
  if (L >= 0.80) return "ink1";
  if (L >= 0.62) return "muted0";
  if (L >= 0.47) return "muted1";
  if (L >= 0.365) return "line0";
  if (L >= 0.285) return "line1";
  if (L >= 0.215) return "panel2";
  if (L >= 0.155) return "panel1";
  return "bg0";
}

const ROLE_CSS = {
  paper: "var(--ts-paper)",
  paperInk: "var(--ts-paper-ink)",
  paperInkMuted: "var(--ts-paper-ink-muted)",
  accentHi: "var(--ts-accent-hi)",
  accent: "var(--ts-accent)",
  accentDim: "var(--ts-accent-dim)",
  accentDeep: "var(--ts-accent-deep)",
  danger: "var(--ts-danger)",
  success: "var(--ts-success)",
  info: "var(--ts-info)",
  purple: "var(--ts-purple)",
  ink0: "var(--ts-ink-0)",
  ink1: "var(--ts-ink-1)",
  muted0: "var(--ts-ink-muted-0)",
  muted1: "var(--ts-ink-muted-1)",
  line0: "var(--ts-line-0)",
  line1: "var(--ts-line-1)",
  panel2: "var(--ts-panel-2)",
  panel1: "var(--ts-panel-1)",
  bg0: "var(--ts-panel-0)"
};

function tokenName(hex) {
  return "--cd-t" + hex.slice(1).toLowerCase();
}
function alphaTokenName(hex8) {
  return "--cd-a" + hex8.slice(1).toLowerCase();
}

function build() {
  let css = fs.readFileSync(DECK, "utf8");

  /* collect every literal first: 6-digit plus the base of any 8-digit alpha */
  let literals = Array.from(new Set(css.match(HEX) || [])).map((h) => h.toLowerCase());
  const alphaLiterals = Array.from(new Set(css.match(HEX8) || [])).map((m) => m.toLowerCase());
  alphaLiterals.forEach(function (m) {
    const base = "#" + m.slice(1, 7);
    if (!literals.includes(base)) literals.push(base);
  });
  literals = literals.sort();
  const roles = {};
  literals.forEach((hex) => { roles[hex] = roleOf(hex); });

  /* 1a. 8-digit literals get their own token; the default value is the exact
     literal (pixel-identical), and the theme role map re-expresses it as an
     alpha mix of the themed base colour. */
  css = css.replace(HEX8, (m) => "var(" + alphaTokenName(m) + ")");
  /* 1b. swap every literal for its token */
  css = css.replace(HEX, (m) => "var(" + tokenName(m) + ")");

  /* 2. the legacy --cd-* aliases at the top now read from the same tokens */
  css = css.replace(
    /\.command-deck\{--cd-bg:[^}]*?--cd-gold:[^}]+\}/,
    ".command-deck{--cd-gold:var(" + tokenName("#edc47c") + ");color:var(--cd-text);background:var(--cd-bg);border:1px solid var(--cd-line);padding:26px;border-radius:6px;font-family:system-ui,sans-serif;box-shadow:0 15px 45px #0003;max-width:1600px;margin:0 auto}"
  );

  /* 3. defaults block, idempotent */
  const defs = literals.map((hex) => tokenName(hex) + ":" + hex)
    .concat(alphaLiterals.map((h8) => alphaTokenName(h8) + ":" + h8)).join(";");
  const defBlock = "/* Deck palette tokens — defaults reproduce the classic green deck exactly. */\n:root{--cd-bg:var(" + tokenName("#192b2c") + ");--cd-panel:var(" + tokenName("#223738") + ");--cd-line:var(" + tokenName("#3e5551") + ");--cd-text:var(" + tokenName("#f2edda") + ");--cd-muted:var(" + tokenName("#acbcb0") + ");--cd-gold:var(" + tokenName("#edc47c") + ");" + defs + "}\n";
  css = css.replace(/\/\* Deck palette tokens[^\n]*\n:root\{[^\n]*\}\n/, "");
  css = defBlock + css;

  fs.writeFileSync(DECK, css);

/* 4. regenerate the role map inside theme-studio.css */
  let theme = fs.existsSync(THEME_CSS) ? fs.readFileSync(THEME_CSS, "utf8") : "";
  /* The six legacy aliases compose tokens at :root, so they must be
     re-declared here too: custom properties resolve where they are set. */
  const LEGACY = {
    "--cd-bg": "var(--ts-panel-0)", "--cd-panel": "var(--ts-panel-1)", "--cd-line": "var(--ts-line-0)",
    "--cd-text": "var(--ts-ink-0)", "--cd-muted": "var(--ts-ink-muted-0)", "--cd-gold": "var(--ts-accent)"
  };
  const legacyDecls = Object.keys(LEGACY).map(function (alias) {
    return "  " + alias + ":" + LEGACY[alias] + ";";
  }).join("\n");
  const roleDecls = legacyDecls + "\n" + literals.map((hex) => "  " + tokenName(hex) + ":" + ROLE_CSS[roles[hex]] + ";")
    .concat(alphaLiterals.map(function (h8) {
      const pct = Math.round((parseInt(h8.slice(7, 9), 16) / 255) * 100);
      return "  " + alphaTokenName(h8) + ":color-mix(in srgb, var(" + tokenName(h8.slice(0, 7)) + ") " + pct + "%, transparent);";
    })).join("\n");
  const block = START + "\n/* Every management-deck colour reads from the active theme's own\n   surface / ink / accent ramps while tinting is enabled. With tinting off\n   (or on Midnight Gold) the literals above keep the classic green deck. */\nbody.ts-deck-theme[data-theme]{\n" + roleDecls + "\n}\n" + END;
  if (theme.includes(START) && theme.includes(END)) {
    theme = theme.replace(new RegExp(START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), block);
  } else {
    theme = theme + "\n" + block + "\n";
  }
  fs.writeFileSync(THEME_CSS, theme);
  const counts = {};
  literals.forEach((h) => { counts[roles[h]] = (counts[roles[h]] || 0) + 1; });
  console.log("tokens:", literals.length, "roles:", counts);
}

build();
