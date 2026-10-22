# LPC Revised character artwork — OGA-BY 3.0

These assets are not CC0. Commercial use, modification and redistribution are
permitted under OGA-BY 3.0 with attribution and notice of modifications.
License URI / legal code: https://static.opengameart.org/OGA-BY-3.0.txt

## Discovery and exact source

Itch.io discovery: https://pflat.itch.io/lpc-character-generator
That tool links to the LPC artwork ecosystem. We did NOT import its executable,
UI or music, and do not claim that these PNGs were downloaded from itch.io.
We selected the compatible artist-maintained LPC Revised collection instead:
https://github.com/ElizaWy/LPC
Pinned commit: f07f7f5892e67c932c68f70bb04472f2c64e46bc

## Attribution

Artwork by Stephen Challener (Redshrike), Eliza Wyatt (DeathsDarling), Durrani,
Benjamin K. Smith (BenCreating), Johannes Sjölund (Wulax), bluecarrot16 and Thecilekli.

The artist's original per-part credits, sources and licenses are retained in:
- Characters-Credits.txt
- Characters-Clothing-Credits.txt
- Characters-Hair-Credits.txt
- README.md

The repository's per-part credit files explicitly license all selected body,
head, clothing and hair layers under OGA-BY 3.0. We rely on these specific
credits, not on a 'free download' label or the general license of another pack.
`sources.json` lists every selected path, immutable Git blob SHA, local source
file, composited look and upstream commit. Original PNG layers are retained in
`source/`. Nothing from the pack is fetched at runtime.

## Modifications in Box Office War

Selected skin, body, clothing and hair layers were combined into 24 people.
Frames were cropped/repacked, seated poses repositioned and portrait crops made.
The renderer adds original paper/slate/camera/sound tools and ground shadows.
Walking uses eight original frames; idle uses three original frames. Sitting
uses the chair pose. Other work/reaction states reuse these poses with contextual
tools/bubbles; they are NOT advertised as dedicated new artist animations.

Build: `node scripts/build-lpc-people.cjs` (checked-in source layers, offline).
Source importer: `python3 scripts/import-lpc-people.py` (gh required only for
re-importing upstream source). In-game attribution: People → Character art credits.
Existing application-code licensing is unchanged. This notice applies to the LPC
art and its composited sheets/portraits, not to unrelated original game assets.
