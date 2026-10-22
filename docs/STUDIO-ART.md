# Original studio art and animation contract

The original actor/facility family in `assets/studio/` is deterministic art authored in
`scripts/build-studio-art.cjs`. No reference-game assets are copied. Earlier suitable
assets remain in the repository for compatibility, but the active lot uses this
single actor atlas family. Additional CC0 furniture/landscaping is documented below.
Generation needs the existing development dependency `sharp`:

```
npm ci
npm run art:studio
```

## Actors

Seven roles: writer, editor, director, camera operator, leading actor, producer,
and audience. Each sheet is 96×896 transparent pixels: four 24×32 frames across,
and 28 rows (`stateIndex * 4 + directionIndex`). States are idle, walk, work,
interact, celebrate, react and rest. Directions are south, west, east and north.
`assets/studio/actors.json` is the art contract; `StudioActors.frame` is the only
runtime frame selector. State names from existing saves (`walking`) normalize to
`walk`. Tests exhaust all rows and their source rectangles.

Walking frames advance by **distance travelled**, not arbitrary elapsed time.
Stationary actions advance by state elapsed time, reset by engine transitions.
Foot anchors never bounce; celebration raises the body/arms without moving the
world-space position. Reduced motion selects a stable frame while preserving
necessary navigation. Skin, outlines, lighting and size are shared across roles.
Role-specific work props include writing paper/pencil, editing monitor/controls,
producer notes, clapper, camera, actor gestures and cinema refreshments.

Idle/rest intentionally have subtle/no movement: they are not decorative activity.
Celebrate only follows an actual production leaving a department. React follows
an invalidated route; blocked crowds wait/replan. The engine—not the renderer—owns
these transitions. Cutaways and campus use the exact same agent, state and atlas.

## Facilities

Eight 160×140 isometric illustrations: warehouse stage, LED volume, multi-level
post suite, pitched-roof writers' bungalow, studio gate, backlot workshop, cinema
with marquee/screen, and executive tower. The art shares a common ground diamond,
flat shadows, restrained studio palette and planted corners. No blur, glow,
particles or gradients are generated. Pixel grid scaling is nearest-neighbour.

## Extending

Add a role to the generator and `StudioActors.roles` with a complete atlas—not a
single static portrait mislabeled as an animation. Add a state to both metadata
and the runtime state machine, then extend the row/bounds tests. Keep all
simulation updates in `studio-lot-engine.js`; neither drawing module owns a timer
or animation loop. Regenerate, run `npm run test:lot`, rebuild the web bundle and
run `npm run test:packaging` so Android/offline assets stay in sync.

## Asset-led visual follow-up

Live department furniture and campus perimeter vegetation now additionally use
CC0 Kenney assets under `assets/vendor/`, not the original procedural family.
Unmodified licenses, sources and derivative details are included there. See
`ART-DIRECTION-PASS.md` for the implemented integration and updated screenshots.
