# ISC — Building Map

An interactive, floor-by-floor map of ISC. Click a room to see details, and
jump between floors with the elevator-style button panel in the corner.

**Live demo:** enable GitHub Pages (see below) and it'll be at
`https://<your-username>.github.io/<repo-name>/`

## How it works

- Each floor is a plain image (`assets/floorplans/ISC-N.png`) shown with
  [Leaflet](https://leafletjs.com/) in `L.CRS.Simple` mode — this treats the
  image as a flat pixel plane instead of a geographic map, which is what you
  want for an indoor floor plan.
- An optional site-context layer (`assets/transparentlandscape.png`) can be
  toggled on with the "SHOW LANDSCAPE" button. It's the same 4000×3297 canvas
  as the floor plans with the building footprint cut out, so it lines up
  exactly underneath them. Because the floor plan PNGs are fully opaque
  (including their white "empty" background), showing the landscape also
  keys the floor plan's near-white pixels to transparent client-side
  (`src/landscapeLayer.js`, canvas-based, cached per floor) — otherwise the
  landscape would never be visible.
- Room outlines are **not** part of the image — they're polygons defined in
  JSON (`data/floorN.json`), drawn on top and clickable.
- The floor control (`src/floorControl.js`) is a fixed overlay panel, not
  part of the map itself, so switching floors never resets your pan/zoom
  position.
- Room search (`src/search.js`) loads every floor's JSON once and filters by
  room ID as you type, then jumps straight to the right floor.

## Currently included

Four floors, **0 through 3**, all one building (ISC). Floor 4 isn't wired
up yet — see "Known limitations" below.

- All four floor plan images (`assets/floorplans/ISC-0.png` …
  `ISC-3.png`) are the finalized, full-detail floor plans, each
  **4000 × 3297px**.
- **No rooms are traced yet on any floor.** The floor plan images were
  swapped for a different (larger, differently-composed) export since the
  last polygon pass — the old `data/floorN.json` files had `imageSize:
  [2648, 1584]` and room coordinates traced against that image, which no
  longer matches. Stretching those old polygons over the new 4000×3297
  images wouldn't just be offset, it'd be visibly warped (the aspect ratio
  changed too). Rather than ship warped polygons, every floor's `rooms`
  array has been cleared and `imageSize` corrected to `[4000, 3297]` to
  match the finalized assets. Use `tools/polygon-editor.html` against the
  real images to re-trace.

## Adding a real floor

1. Drop the floor plan image in `assets/floorplans/`, named `ISC-N.png`.
   Note its pixel dimensions (`file image.png` on macOS/Linux, or check
   image properties on Windows) — update `imageSize` in that floor's JSON
   if it differs from the others.
2. Open `tools/polygon-editor.html` locally (see "Running locally" below —
   it needs a local server, not a `file://` double-click). Load your image,
   click each room's corners in order, name it, hit "Save room". Repeat for
   every room, then copy the exported JSON.
3. Paste that JSON into the `"rooms"` array of `data/floorN.json`, matching
   the existing format.
4. If you added a floor number that didn't exist before, add it to `FLOORS`
   in `src/mapConfig.js`.

Room categories currently understood: `room`, `open-area`, `elevator`,
`stairs` — each maps to a primary color (`src/mapConfig.js` →
`CATEGORY_STYLE`). There's intentionally no on-screen legend; category
shows up in the info panel when you click a room. Add more categories there
if you need other types (e.g. restrooms, labs).

## Running locally

Because the app loads floor data with `fetch()`, opening `index.html`
directly (`file://...`) will fail due to browser CORS restrictions on local
files. Run a tiny local server from the repo root instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or, with Node installed:

```bash
npx serve .
```

## Deploying to GitHub Pages

No build step is required — this is plain HTML/CSS/JS.

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Set **Branch** to `main` and folder to `/ (root)`, then save.
5. Your site will be live at `https://<username>.github.io/<repo-name>/`
   within a minute or two. Every push to `main` redeploys automatically.

## Project structure

```
index.html                  Entry point
styles/main.css             All styling (white / black / primary-color, squared corners)
src/
  main.js                    Bootstraps the map, wires everything together
  mapConfig.js                Which floors exist, category colors, file paths
  pixelCRS.js                 Pixel <-> Leaflet coordinate helpers
  roomLayer.js                 Draws room polygons from JSON
  floorControl.js              The corner floor-select panel
  search.js                    Global room search
  landscapeLayer.js            Client-side chroma-key for the landscape toggle
data/
  floor0.json ... floor4.json  Per-floor room data
assets/floorplans/            Floor plan images (ISC-0.png ... ISC-4.png)
tools/polygon-editor.html     Standalone tool for tracing room polygons
```

## Known limitations / next steps

- **No floor has traced rooms right now** — this is the top-priority data
  task. Use `tools/polygon-editor.html` against the finalized images in
  `assets/floorplans/` and paste the exported JSON into each `data/floorN.json`.
  Room IDs don't need to match the real printed room numbers yet — get the
  shapes right first.
- **Floor 4 doesn't exist yet.** `FLOORS` in `src/mapConfig.js`
  intentionally excludes it. To add it: drop `ISC-4.png` in
  `assets/floorplans/`, create `data/floor4.json` (trace rooms with the
  polygon editor), then add `4` back into `FLOORS`.
- Room metadata is minimal (id + category). Extend the JSON schema with
  fields like `department`, `capacity`, or `notes` and update
  `updateInfoPanel()` in `src/main.js` to display them.
- Very large floor images (beyond ~4000px on a side) may load slowly as a
  single file. If that becomes a problem, look at Leaflet's tile layers
  instead of `imageOverlay`.
- The polygon editor tool is intentionally rough — it's for you, not end
  users. Feel free to extend it (e.g. editing existing polygons, not just
  adding new ones).
- The landscape toggle's chroma-key threshold (`WHITE_THRESHOLD` in
  `src/landscapeLayer.js`) assumes floor plan backgrounds stay near-white.
  If a future floor plan export uses a tinted or textured background, that
  threshold will need revisiting.
