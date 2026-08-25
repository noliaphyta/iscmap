# ISC — Building Map

An interactive, floor-by-floor map of ISC. Search for a room number to drop
a pin on it, hover the floor plan to see what kind of space is under your
cursor, and jump between floors with the elevator-style button panel in the
corner.

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
- **Two independent room-data systems are live at once**, because neither
  one alone is both accurate and complete yet — see "Room data" below for
  the full story:
  - **Room search → dot** (`src/roomDotLayer.js`, `tools/ocr_ingest.py`):
    every floor's room-number text has been OCR'd directly off the image
    into a `labels` array (`{ room_number, x, y }`). Typing a room number
    in search drops a single pulsing marker on its detected location — this
    is the accurate, ID-correct way to find a specific room.
  - **Hover-to-browse category** (`src/colorProbe.js`): hovering (or
    tapping, on mobile) anywhere else on the floor plan samples the image's
    own baked-in swatch color under the cursor and shows the matching
    category (e.g. "laboratory facilities") in the info panel — a stopgap
    for general browsing that doesn't require verified room shapes.
  - **Room polygons** (`src/roomLayer.js`) are traced for all four floors
    but withheld — `ROOMS_ENABLED` in `src/mapConfig.js` is `false` — until
    someone verifies them against the real building. Once flipped on,
    they'd add hover/click-to-browse-by-shape on top of the two systems
    above, not replace them.
- The floor control (`src/floorControl.js`) is a fixed overlay panel, not
  part of the map itself, so switching floors never resets your pan/zoom
  position.
- Room search (`src/search.js`) loads every floor's `labels` once and
  filters by room number as you type, then jumps straight to the right
  floor and shows the dot.

## Currently included

Four floors, **0 through 3**, all one building (ISC). Floor 4 isn't wired
up yet — see "Known limitations" below.

- All four floor plan images (`assets/floorplans/ISC-0.png` …
  `ISC-3.png`) are the finalized, full-detail floor plans, each
  **4000 × 3297px**.
- Point features (exits, elevators, restrooms, cafés, etc. — the
  `features` array in each `data/floorN.json`) are populated and live on
  the map for all four floors.
- OCR'd room-number labels (the `labels` array) are populated for all four
  floors and drive search → dot. Low-confidence OCR reads are held in each
  floor's `flagged` array for manual review (see `tools/label-editor.html`).
- Room polygons are traced for all four floors (145–241 rooms each) but
  **not currently shown on the map** — see "Room data" below for why, and
  how to turn them back on.

## Room data

### Room-number labels (search, live now)

`tools/ocr_ingest.py` scans a floor plan image for room-number text and
writes a validated `labels` array (accurate room ID, no shape — just the
text's centroid point) plus a `flagged` array for low-confidence reads:

```bash
python3 tools/ocr_ingest.py --floor 1 \
  --image assets/floorplans/ISC-1.png \
  --data data/floor1.json --merge
```

Requires `pytesseract`, `Pillow`, and the `tesseract` binary. Open
`tools/label-editor.html` locally to review/fix flagged points, add missed
rooms by clicking the map, or move/delete existing ones — it reads and
writes `data/floorN.json`'s `labels`/`flagged` keys directly and preserves
every other key in the file.

### Room polygons (traced, withheld)

The public `data/floorN.json` files each ship an empty `rooms` array on
purpose. The actual traced polygons exist — they live in
`data/source/floorN.json` instead, alongside the tooling to verify and
publish them:

- **Why they're withheld:** the floor plan images were swapped for a
  different (larger, differently-composed) export at some point, and while
  the current `data/source/floorN.json` files have been updated to the
  right `imageSize` (`[4000, 3297]`), the room polygons in them haven't
  been re-verified against the current images room-by-room. Shipping
  unverified polygons as real data risked showing confidently wrong room
  shapes/positions, which is worse than not showing them.
- **`tools/polygon-editor.html`** reads from and writes to
  `data/source/floorN.json`, never the public files — so in-progress
  tracing/fixing work can never accidentally go live mid-edit.
- **`tools/publish-rooms.py`** copies a floor's verified `rooms` array from
  `data/source/floorN.json` into the public `data/floorN.json` once you've
  checked it: `python3 tools/publish-rooms.py 2` (or `--all`). This only
  touches the `rooms` key — `labels`, `flagged`, `features`, `image*` in
  the public file are left exactly as they are.
- Once at least one floor has real rooms published, flip `ROOMS_ENABLED`
  to `true` in `src/mapConfig.js` to turn the room-polygon layer back on
  (it renders alongside, not instead of, the dot-search and hover-category
  systems). See `data/source/README.md` for the full workflow.

## Adding a real floor

1. Drop the floor plan image in `assets/floorplans/`, named `ISC-N.png`.
   Note its pixel dimensions (`file image.png` on macOS/Linux, or check
   image properties on Windows) — update `imageSize` in that floor's JSON
   if it differs from the others.
2. Run `tools/ocr_ingest.py --merge` against it (see "Room data" above) to
   populate `labels`/`flagged` so search works for the new floor
   immediately.
3. Open `tools/polygon-editor.html` locally (see "Running locally" below —
   it needs a local server, not a `file://` double-click) if you also want
   to trace room polygons. Load your image, click each room's corners in
   order, name it, hit "Save room". Repeat for every room, then copy the
   exported JSON into the `"rooms"` array of `data/source/floorN.json`
   (**not** `data/floorN.json`).
4. Once you've verified the room shapes against the real building, run
   `python3 tools/publish-rooms.py N` to publish that floor's polygons into
   the public `data/floorN.json`.
5. If you added a floor number that didn't exist before, add it to
   `FLOORS` in `src/mapConfig.js`.

Room categories currently understood (`src/mapConfig.js` →
`CATEGORY_STYLE` / `SWATCH_COLORS`): `building-services`, `circulation`,
`classroom-facilities`, `general-use`, `laboratory-facilities`,
`mechanical`, `office-facilities`, `special-use`, `study-facilities`,
`support`, `no-value`. `CATEGORY_STYLE` colors the room-polygon layer once
it's on; `SWATCH_COLORS` is what `colorProbe.js` matches against for the
hover stopgap. There's intentionally no on-screen legend for these (unlike
the point-feature icon key) — category shows up in the info panel on
hover/click. Add more categories to both if you need other types.

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
   (`.nojekyll` is included so GitHub Pages serves files/folders starting
   with `_` or `.` as-is, without running them through Jekyll first.)

## Project structure

```
index.html                  Entry point
styles/main.css             All styling (white / black / primary-color, squared corners)
src/
  main.js                    Bootstraps the map, wires everything together
  mapConfig.js               Which floors exist, ROOMS_ENABLED, category colors, file paths
  pixelCRS.js                Pixel <-> Leaflet coordinate helpers
  roomLayer.js               Draws room polygons from JSON (currently unused - see "Room data")
  roomDotLayer.js            Draws the single search-result dot from a room's OCR'd label
  featureLayer.js            Draws point features (exits, elevators, restrooms, etc.)
  icons.js                   Feature type -> icon/label registry
  colorProbe.js              Color-sampling stopgap for category info while rooms are off
  floorControl.js            The corner floor-select panel
  legend.js                  Collapsible point-feature icon key (bottom-right)
  search.js                  Global room-number search (indexes `labels`)
  landscapeLayer.js          Client-side chroma-key for the landscape toggle
data/
  floor0.json ... floor3.json   Public per-floor data the app fetches (rooms empty, labels populated)
  source/floor0.json ... floor3.json   Full data incl. unverified room polygons - see data/source/README.md
assets/floorplans/          Floor plan images (ISC-0.png ... ISC-3.png)
tools/
  polygon-editor.html       Standalone tool for tracing/fixing room polygons (edits data/source/)
  publish-rooms.py          Publishes a verified floor's rooms from data/source/ into data/
  ocr_ingest.py              OCRs room-number labels off a floor plan image into data/floorN.json
  label-editor.html          Review/fix OCR'd room labels and flagged low-confidence reads
```

## Known limitations / next steps

- **Room polygons are traced but not shown** — see "Room data" above for
  why, and the steps to verify and publish a floor.
- **Floor 4 doesn't exist yet.** `FLOORS` in `src/mapConfig.js`
  intentionally excludes it. To add it: drop `ISC-4.png` in
  `assets/floorplans/`, run `ocr_ingest.py` against it, create
  `data/source/floor4.json` (trace rooms with the polygon editor) if you
  also want polygons, publish once verified, then add `4` back into
  `FLOORS`.
- Room metadata is minimal (room number + floor for labels; id + category
  for polygons). Extend the JSON schema with fields like `department` or
  `notes` and update `updateInfoPanel()` in `src/main.js` to display them.
- Very large floor images (beyond ~4000px on a side) may load slowly as a
  single file. If that becomes a problem, look at Leaflet's tile layers
  instead of `imageOverlay`.
- Both editor tools (`polygon-editor.html`, `label-editor.html`) are
  intentionally rough — they're for you, not end users.
- The landscape toggle's chroma-key threshold (`WHITE_THRESHOLD` in
  `src/landscapeLayer.js`) assumes floor plan backgrounds stay near-white.
  If a future floor plan export uses a tinted or textured background, that
  threshold will need revisiting.
