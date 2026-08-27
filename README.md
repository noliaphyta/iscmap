# Campus Map

An interactive, floor-by-floor map of two campus buildings. Search for a
room number to jump to it, click any room for its category and description,
and switch floors with the elevator-style button panel in the corner. Both
buildings render together on one shared floor stack — pick a level and you
see both buildings' rooms for that level at once.

**Live demo:** enable GitHub Pages (see below) and it'll be at
`https://<your-username>.github.io/<repo-name>/`

## How it works

- The map is pure vector, rendered directly from room polygon geometry in
  `data/rooms.geojson` — there is no background floor-plan image. Leaflet
  runs in `L.CRS.Simple` mode (`src/pixelCRS.js`), treating the geojson's
  own local coordinate units as a flat plane instead of a geographic map.
  Bounds for each floor are computed from that floor's feature bbox
  (`boundsForFeatures()`) rather than from an image's pixel dimensions.
- `src/geoData.js` fetches the geojson once on load and builds every index
  the app needs: rooms grouped by building/floor, the canonical floor list,
  and the search index. It also resolves the one data quirk that needs
  special-casing: Building 1's basement is labeled `FloorB` and Building 2's
  is labeled `Floor0` — same physical level, different label. Both are
  canonicalized to a single `"B"` floor button instead of showing two
  separate basements (`levelOf()` / `canonicalLevel()`).
- Building 1 and Building 2 coordinates already share one aligned
  coordinate space (a translate-only transform, no rotation/mirroring, was
  applied upstream before this data was handed off) — the app just renders
  both buildings' features as-is, with no further alignment step.
- `src/roomLayer.js` draws each room as a polygon colored by category, with
  a room-number label placed at an area-weighted centroid (not a vertex
  average, which misplaces labels on L-shaped/notched rooms). Labels are
  `pointer-events: none` and non-selectable, so they never intercept clicks
  meant for the room underneath and never trigger a text-selection drag.
  Label size and icon size scale with zoom (measured via
  `latLngToContainerPoint`) rather than being fixed to a CRS formula.
- Rooms with `geometry: null` (~2% of the data, a flaky upstream scrape)
  aren't drawn and can't be zoomed to, but they're still indexed for search
  by `room_number` and show up as an unzoomed, clearly-labeled result.

## Room data

`data/rooms.geojson` is the single source of truth for room shapes,
numbers, and categories — replacing the three partial systems the previous
version of this app carried (OCR'd room-number dots, a color-probe hover
stopgap, and unverified traced polygons sitting inert behind a feature
flag). All three, and the tooling that produced them, have been deleted:
`src/colorProbe.js`, `src/roomDotLayer.js`, `tools/ocr_ingest.py`,
`tools/label-editor.html`, `tools/polygon-editor.html`,
`tools/publish-rooms.py`, and `data/source/`.

The floor-plan PNGs (`assets/floorplans/`) and the landscape-background
toggle (`src/landscapeLayer.js`, `assets/transparentlandscape.png`, the
"SHOW/HIDE LANDSCAPE" button) are also gone. The landscape image was
chroma-keyed to the exact pixel canvas of the old floor-plan PNGs; that
alignment has no meaning in the geojson's coordinate space. If a
site-context backdrop is wanted later, it needs a fresh image aligned to
the geojson's bounding box — that's a new task, not something this handoff
solves.

### Category colors

`src/mapConfig.js`'s `CATEGORY_STYLE` palette is reused verbatim from the
previous version. `categoryKey()` normalizes a raw `Category` string (trim,
lowercase, spaces → hyphens) so it matches `CATEGORY_STYLE`'s keys without
a hand-maintained mapping table.

### Icons

oldmap's existing `icons/` set (built for manually-placed point features
like exits, elevators, and restrooms) is reused, but placement is now
automatic: `src/icons.js` infers an icon per room from its data and
`roomLayer.js` places it at the room's centroid.

Category alone is too coarse to drive this — restrooms, for example, are
`Category: "Building Services"` / `SubCategory: "Public Rest Room"`, so a
category-only match misses them. `iconPathFor()` checks `SubCategory`
first (see the table in `src/icons.js`), and only falls back to a
`Category`-level match (currently just `study-facilities` →
`waitingroom.svg`) when no subcategory signal exists. Rooms that match
neither get no icon at all — that's deliberate: a weak or misleading icon
on a generic office or storage room is worse than none.

**Known gap, not solved by room data alone:** the old point-feature system
also covered exit signage (`down-arrow.svg`, `uparrow.svg`, etc.) —
directional arrows pointing toward the nearest exit. `FAMIS` categorizes
rooms, not wayfinding points, so nothing here auto-places exit arrows from
room data, and that's still true. What's new: `tools/annotate.html` (see
"Publishing annotations" below) lets someone manually drop any icon in
`icons/` — including the exit-arrow set and `forward-and-left-arrow.svg`/
`forward-and-right-arrow.svg` — as a standalone note anywhere on the map,
independent of room data. The full pickable set lives in one place,
`NOTE_ICONS` in `src/icons.js`, so adding a new `icons/*.svg` file only
needs updating there to become available in the tool.

## Open questions

These were flagged during the geojson migration and are still unresolved —
placeholder copy is in production until someone confirms the answers:

- **Building identity.** The app's original scope was one building (ISC),
  four floors. This geojson covers two buildings (`Building1`, `Building2`,
  numeric IDs `449`/`…`) whose floor counts don't cleanly match that. Is
  either of these ISC? `index.html`'s `<h1>` currently reads a placeholder
  "CAMPUS MAP" (see the `TODO` comment there) instead of a real building
  name/link, pending confirmation.
- **Display names.** The geojson only has opaque numeric `building_id` /
  `floor_id` values and `Building1`/`Building2` labels — real, human-facing
  building and floor names are needed before this ships as production copy.
- **Exit wayfinding.** Whether exit-arrow signage is in scope for a future
  iteration (see "Icons" above) — no exit data exists yet either way.

## Search

Every feature with a non-empty `room_number` is indexed, including rooms
with `geometry: null` — those still appear as search results (so the room
number is findable) but can't be zoomed to, since there's no geometry to
zoom to. Selecting a result switches to that room's canonical floor and
zooms/pans to its bbox.

## Legend

The legend (`src/legend.js`) is a static key — a color swatch and label per
category, plus an icon next to categories that have one
(`categoryIconFileForKey()`). It has the same collapse toggle as before but
no per-category filter checkboxes and no other interactivity.

## Info panel

Clicking a room shows its room number, `Category` (plus `SubCategory` if
present), and `Description`. `Area` and occupancy/vacancy fields are
deliberately left out as noise for this app's purpose.

## Annotations (published overlay)

`tools/annotate.html` is a standalone authoring page for two things room
data doesn't cover: overriding a specific room's fill color, and dropping
freeform icon+text notes anywhere on the map (wayfinding arrows, callouts,
temporary signage, etc.). It reuses the main app's floor stack, geojson,
and pixel-coordinate system, but never touches `data/rooms.geojson` or the
main app's own room polygons/`src/roomLayer.js` — it's fully additive.

**Two separate copies of this data exist at any time**, and it's worth
being clear about which is which:

- **Your local draft** — everything you paint/place in `annotate.html` is
  saved automatically to that browser's `localStorage` as you go. Nobody
  else can see it; it's not shared or synced anywhere on its own, and it's
  gone if you clear that browser's site data without exporting first.
- **The published overlay** (`data/annotations.json`) — a plain JSON file
  committed to the repo like `data/rooms.geojson` is. This is what every
  visitor of the deployed site actually sees, fetched and rendered by
  `src/annotations.js` (room color overrides) and `src/notesLayer.js`
  (notes) from `src/main.js` on every page load. It only changes when
  someone explicitly publishes an update to it — nothing here auto-syncs
  from anyone's local draft.

### Publishing an update

1. Open `tools/annotate.html`, make your changes (colors/notes are saved
   to your browser automatically as you go).
2. In the "Your annotations" panel, click **Export JSON** — this downloads
   `annotations.json` (already named to match the path below, so no
   renaming needed).
3. Replace `data/annotations.json` in the repo with the downloaded file.
4. Commit and push. GitHub Pages redeploys automatically — no build/CI
   step, same as every other change to this repo (see "Deploying" above).
   `src/annotations.js` fetches with `cache: "no-store"`, so visitors see
   the update on their very next page load rather than a stale cached
   copy.

A missing or not-yet-created `data/annotations.json` isn't an error state
— `loadPublishedAnnotations()` treats a 404 as "nothing published yet" and
the map renders normally with just its default category colors and no
notes. The committed placeholder (`{"version":1,"rooms":{},"notes":[]}`)
exists so a fresh clone/deploy has a well-formed file from the start
regardless.

Whatever's fetched is re-validated against the same rules
`annotateMain.js` already applies to an *imported* file (only
`"#rrggbb"`-shaped room colors; notes require numeric `x`/`y` and an icon
from `NOTE_ICONS` or `null`) before anything renders it — since this file
is fetched over the network and parsed as JSON at runtime, not just
reviewed once at commit time.

## Running locally

No build step, no bundler — this is plain ES modules served as static
files.

```bash
python3 -m http.server
```

Then open `http://localhost:8000/`.

## Deploying

Push to a GitHub repo with Pages enabled (see `.nojekyll`, already present
so Pages serves the `src/`/`data/`/`icons/` folders as-is without Jekyll
processing). No build/CI step is required — the deployed branch's files are
served directly.

## File structure

```
index.html
tools/annotate.html    — standalone room-color/note annotation tool
styles/main.css       — oldmap's visual identity, unchanged (Jost font,
                         black 2px borders, hard offset shadows, poster
                         color accents), minus the deleted landscape toggle
styles/annotate.css   — annotate.html's own additions on top of main.css
data/
  rooms.geojson        — single source of truth for all room data
  annotations.json      — published room-color overrides + notes (see
                           "Annotations" above); safe to be empty/absent
src/
  mapConfig.js          — GEOJSON_PATH, ANNOTATIONS_PATH, CATEGORY_STYLE, categoryKey()
  geoData.js             — loads/indexes the geojson, floor canonicalization
  pixelCRS.js            — CRS.Simple helpers, boundsForFeatures()
  roomLayer.js            — polygons, centroid labels, icon placement
  floorControl.js        — dynamic floor-stack button panel
  legend.js               — static category key
  search.js               — room-number search over the geojson index
  icons.js                — subcategory/category → icon file resolution,
                             NOTE_ICONS (annotate.html's icon picklist)
  annotations.js          — fetches + validates the published overlay
  notesLayer.js            — shared note-marker builder (annotate.html +
                              main app's read-only rendering)
  annotateMain.js          — tools/annotate.html's own app bootstrap
  main.js                  — app bootstrap
icons/                  — oldmap's icon set (includes exit-arrow icons,
                          now placeable via tools/annotate.html - see
                          "Icons" above)
assets/icon.png         — favicon/site icon
```
