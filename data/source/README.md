# data/source/

Working copies of each floor's full data, **including room polygons that
haven't been verified against the real building yet.**

## Why this exists

All four floors *do* have traced room polygons (145–241 rooms each) - but
they were traced against a since-replaced floor plan export and haven't
been re-validated against the current `assets/floorplans/ISC-N.png`
images, so the shapes/positions aren't trustworthy. Rather than either
deleting that tracing work or shipping unreliable room data to real users,
it lives here instead: same file shape as the public `data/floorN.json`,
just not on the path the live app (`src/mapConfig.js` → `dataPath()`)
ever fetches.

`tools/polygon-editor.html` reads and writes here, not the public files -
so authoring/fixing room data never accidentally goes live mid-edit.

## Publishing a floor once it's verified

1. Fix up / re-verify the floor's rooms in `tools/polygon-editor.html`
   (it loads from here automatically) and save your changes back into
   `data/source/floorN.json`.
2. Run `python3 tools/publish-rooms.py N` (or `--all` for every floor) to
   copy that floor's verified `rooms` array into the public
   `data/floorN.json`. This only touches `rooms` - `imageSize`/`image`/
   `features` in the public file are untouched.
3. Once at least one floor has real room data published, flip
   `ROOMS_ENABLED` to `true` in `src/mapConfig.js` to turn the room-polygon
   layer back on (it currently falls back to the color-probe stopgap - see
   `src/colorProbe.js`).

Until step 3, published rooms sit in the public JSON unused - harmless,
but there's no reason to do step 2 for a floor you haven't actually
verified.
