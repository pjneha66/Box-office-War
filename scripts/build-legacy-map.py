#!/usr/bin/env python3
"""Generate system/legacy-map.css.

The UI accumulated four palettes: --cd-t* (command-deck), --ts-* (theme-studio),
--bow-* (bow-restyle) and the v30 tokens. Rewriting ~10k lines of CSS to use one
palette is not realistic, and hand-mapping 650 variables is not maintainable.

Instead this script reads every legacy declaration, classifies the colour by hue
and lightness, and re-points it at the new semantic token that plays the same
role. The legacy CSS keeps its own selectors and rules; it just stops being able
to pick its own colours.

Run after adding new legacy variables:  python3 scripts/build-legacy-map.py
"""
import glob
import os
import re
import colorsys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILIES = ("--cd-", "--ts-", "--bow-")
HEX = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")



def split_selectors(sel_list):
    """Split a selector list on top-level commas only.

    Naive splitting breaks functional pseudo-classes: `:is(.a, .b)` becomes
    `:is(.a` and `.b)`, which are invalid and abort parsing of everything after
    them in the stylesheet.
    """
    out, depth, buf = [], 0, ""
    for ch in sel_list:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            out.append(buf)
            buf = ""
        else:
            buf += ch
    out.append(buf)
    return [x.strip() for x in out if x.strip()]


def to_rgb(value):
    m = HEX.match(value.strip())
    if not m:
        return None
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def classify(rgb):
    """Return the semantic token that should replace this colour.

    Classification uses CHROMA (max-min), not HSL saturation. HSL saturation
    explodes for near-white and near-black colours that merely carry a warm or
    cool cast — a cream text colour like #f2edda scores 0.5 and would otherwise
    be mistaken for the brand gold. Chroma keeps those in the neutral ramp.
    """
    r, g, b = rgb
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    hue = h * 360
    chroma = max(r, g, b) - min(r, g, b)

    # Structural colours: surfaces, lines, text. Any hue cast here is incidental.
    if chroma < 0.22:
        if l < 0.055:
            return "--surface-0"
        if l < 0.105:
            return "--surface-1"
        if l < 0.155:
            return "--surface-2"
        if l < 0.215:
            return "--surface-3"
        if l < 0.275:
            return "--surface-4"
        if l < 0.34:
            return "--line-1"
        if l < 0.44:
            return "--line-2"
        if l < 0.56:
            return "--line-3"
        if l < 0.66:
            return "--text-3"
        if l < 0.80:
            return "--text-2"
        return "--text-1"

    # Genuinely saturated: classify by hue band.
    if 25 <= hue <= 60:                      # brand gold / brass
        if l < 0.28:
            return "--accent-dim"
        if l < 0.52:
            return "--accent"
        return "--accent-strong"
    if 75 <= hue <= 170:                     # green
        return "--success"
    if hue >= 340 or hue <= 18:              # red
        return "--danger"
    if 18 < hue < 45:                        # warm orange
        return "--warn"
    if 170 <= hue < 260:                     # blue / cyan
        return "--info"
    if 260 <= hue < 320:                     # violet
        return "--violet"
    return "--text-2"


def light_background_overrides(var_colors):
    """Find legacy rules that paint a light colour as a background.

    A cream token used as `color:` is correct (text on a dark panel). The same
    token used as `background:` is a hole in a dark product — the old layers
    shipped light "paper" panels, buttons and chips. Variables cannot express
    "only when used as a background", so this pass rewrites those declarations
    at the property level.
    """
    light = set()
    for var, hexval in var_colors.items():
        rgb = to_rgb(hexval)
        if not rgb:
            continue
        _, l, _ = colorsys.rgb_to_hls(*rgb)
        # Only neutral, light tokens are "paper". A light *green* is a status
        # indicator, not a surface, and flattening it would lose meaning.
        if l > 0.72 and classify(rgb).startswith(("--text", "--surface", "--line")):
            light.add(var)
    if not light:
        return []

    pattern = re.compile(r"([^{}@]+)\{([^{}]*)\}")
    bg = re.compile(r"background(?:-color)?\s*:\s*var\((--[a-zA-Z0-9-]+)\)")
    out = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "*.css"))):
        text = open(path, encoding="utf-8", errors="ignore").read()
        # Strip comments first: comment prose contains braces and words that the
        # rule regex would otherwise capture as selectors.
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        for m in pattern.finditer(text):
            selectors, body = m.group(1).strip(), m.group(2)
            for bm in bg.finditer(body):
                if bm.group(1) in light:
                    for sel in split_selectors(selectors):
                        sel = " ".join(sel.split())
                        if sel:
                            out[sel] = True
                    break
    return sorted(out)


def dark_text_overrides(var_colors):
    """Find legacy rules that paint TEXT with a surface token.

    Those rules were written for light panels: the colour they picked was a dark
    foreground on cream. Now that panels are dark, the same rule produces
    invisible text. Re-emitting the rule's own selector (so specificity ties and
    this file wins on order) with a text token fixes it everywhere at once.
    """
    surface_vars = {
        var for var, hexval in var_colors.items()
        if to_rgb(hexval) and classify(to_rgb(hexval)).startswith("--surface")
    }
    if not surface_vars:
        return []

    pattern = re.compile(r"([^{}@]+)\{([^{}]*)\}")
    fg = re.compile(r"(?<!-)color\s*:\s*var\((--[a-zA-Z0-9-]+)\)")
    # A rule that paints its own light background is a dark-ink-on-gold pairing
    # and is already correct; recolouring it would break the pair.
    own_light_bg = re.compile(r"background(?:-color)?\s*:\s*var\((--[a-zA-Z0-9-]+)\)")
    out = []
    seen = set()
    for path in sorted(glob.glob(os.path.join(ROOT, "*.css"))):
        text = open(path, encoding="utf-8", errors="ignore").read()
        # Strip comments first: comment prose contains braces and words that the
        # rule regex would otherwise capture as selectors.
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        for m in pattern.finditer(text):
            selectors, body = m.group(1).strip(), m.group(2)
            hit = fg.search(body)
            if not hit or hit.group(1) not in surface_vars:
                continue
            bgm = own_light_bg.search(body)
            if bgm:
                bg_rgb = to_rgb(var_colors.get(bgm.group(1), ""))
                if bg_rgb and classify(bg_rgb).startswith("--accent"):
                    continue
            for sel in split_selectors(selectors):
                sel = " ".join(sel.split())
                if sel and sel not in seen:
                    seen.add(sel)
                    out.append(sel)
    return out


def main():
    seen = {}
    for path in sorted(glob.glob(os.path.join(ROOT, "*.css"))):
        name = os.path.basename(path)
        if name in ("legacy-map.css",):
            continue
        text = open(path, encoding="utf-8", errors="ignore").read()
        for m in re.finditer(r"(--(?:cd|ts|bow)-[a-zA-Z0-9]+)\s*:\s*([^;{}]+);", text):
            var, value = m.group(1), m.group(2).strip()
            if var.startswith("--cd-t") and HEX.match(value):
                seen.setdefault(var, value)      # name encodes the hex
            elif var not in seen and HEX.match(value):
                seen[var] = value

    lines = [
        "/* ═══════════════════════════════════════════════════════════════════",
        "   GENERATED FILE — do not edit by hand.",
        "   Regenerate with:  python3 scripts/build-legacy-map.py",
        "",
        "   Re-points the legacy palettes (--cd-t*, --ts-*, --bow-*) at the new",
        "   semantic tokens. The legacy stylesheets keep their selectors and",
        "   rules; they simply lose the ability to choose their own colours.",
        "   ═══════════════════════════════════════════════════════════════════ */",
        "",
        ":root {",
    ]
    mapped = 0
    for var in sorted(seen):
        token = classify(to_rgb(seen[var]))
        lines.append(f"  {var}: var({token});")
        mapped += 1
    lines.append("}")
    lines.append("")

    # Property-level pass: light "paper" backgrounds become dark surfaces.
    sels = light_background_overrides(seen)
    if sels:
        lines.append("/* Legacy rules that painted a light token as a background.")
        lines.append("   They become dark surfaces, and because their text was dark")
        lines.append("   (it was written for a light panel) the text ramp is reapplied")
        lines.append("   to the panel and its children. */")
        for sel in sels:
            lines.append(sel + "{background:var(--surface-2)!important;color:var(--text-1)!important;}")
            lines.append(sel + " :is(h1,h2,h3,h4,h5,b,strong,em){color:var(--text-1)!important;}")
            lines.append(sel + " :is(p,small,span,li,label,td){color:var(--text-2)!important;}")
        lines.append("")
        print(f"neutralised {len(sels)} light-background rules")

    # Pass 3: text painted with a surface token (written for a light panel).
    dark = dark_text_overrides(seen)
    if dark:
        lines.append("/* Rules that painted text with a surface token — invisible once")
        lines.append("   the panels went dark. Same selectors, text ramp instead. */")
        for sel in dark:
            lines.append(sel + "{color:var(--text-2)!important;}")
        lines.append("")
        print(f"recoloured {len(dark)} dark-on-dark text rules")

    out = os.path.join(ROOT, "system", "legacy-map.css")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write("\n".join(lines))
    print(f"mapped {mapped} legacy variables -> system/legacy-map.css")


if __name__ == "__main__":
    main()
