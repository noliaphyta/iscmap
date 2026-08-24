// Central place to declare what floors exist.
// To add a real floor: drop the image in assets/floorplans/ as ISC-N.png,
// add it to FLOORPLAN_IMAGES in tools/polygon-editor.html so it shows up in
// the editor's dropdown, add data/floorN.json (see tools/polygon-editor.html
// to trace room polygons), then list the floor number in FLOORS below.

// Floor 4 is intentionally left out until assets/floorplans/ISC-4.png and
// data/floor4.json exist - listing a floor with no matching data/image
// makes its button a dead click. Add 4 back in once both files are ready.
export const FLOORS = [0, 1, 2, 3];

// Palette matches the "Space Category" legend key. Colors are a more
// aesthetic, harmonized re-interpretation of the key's swatches (which are
// plain default pastels) - tuned to sit well against the black-outline,
// poster-style site theme while staying distinguishable at small polygon
// sizes. Keys match the `category` field written by tools/polygon-editor.html
// and stored in data/floor*.json.
export const CATEGORY_STYLE = {
  "building-services":    { fill: "#5C6B73", label: "Building Services" },
  "circulation":          { fill: "#D8D6D0", label: "Circulation" },
  "classroom-facilities": { fill: "#4FC3E0", label: "Classroom Facilities" },
  "general-use":          { fill: "#F2B9C4", label: "General Use" },
  "laboratory-facilities":{ fill: "#B24FD1", label: "Laboratory Facilities" },
  "mechanical":           { fill: "#A6A69C", label: "Mechanical" },
  "office-facilities":    { fill: "#8FCB9B", label: "Office Facilities" },
  "special-use":          { fill: "#ABABAB", label: "Special Use" },
  "study-facilities":     { fill: "#2E8B8B", label: "Study Facilities" },
  "support":              { fill: "#E8A93A", label: "Support" },
  "no-value":             { fill: "#F2F2EF", label: "No Value" },
};

// Fallback style for any room whose category isn't recognized above.
export const DEFAULT_CATEGORY_STYLE = CATEGORY_STYLE["no-value"];

// Real, baked-in swatch colors from the floor plan PNGs themselves (as
// opposed to CATEGORY_STYLE above, which is this app's own harmonized
// re-color used to draw polygons). Sourced from the "Space Category"
// legend key and cross-checked against actual pixel samples from
// assets/floorplans/ISC-2.png. Used by src/colorProbe.js to guess a
// room's category from the pixel the user is hovering/tapping, while
// room polygons aren't traced yet (see README "Known limitations").
//
// Only categories with a flat, solid legend swatch are listed - anything
// drawn with hatching/patterns (circulation, mechanical,
// building-services) can't be reliably identified this way and is
// intentionally left out, rather than risk mislabeling it.
export const SWATCH_COLORS = {
  "classroom-facilities": [152, 252, 254],
  "general-use":          [248, 210, 209],
  "laboratory-facilities":[238, 135, 249],
  "office-facilities":    [182, 253, 169],
  "special-use":          [192, 192, 192],
  "study-facilities":     [70, 158, 159],
  "support":              [246, 194, 66],
  "no-value":             [240, 240, 240],
};

// Redmean color-distance threshold (see src/colorProbe.js). Below this, a
// sampled pixel is considered a confident match to a swatch category;
// at or above it, the hover subtitle is hidden rather than guess wrong.
// Tuned against the ISC-2 sample dump: true swatch matches landed
// <=102, while background/wall/hatch tones landed >=140 except for a
// gray hatch tone that came uncomfortably close to special-use (~96) -
// worth re-validating against more floors once available.
export const SWATCH_MATCH_THRESHOLD = 120;

export function dataPath(floor) {
  return `data/floor${floor}.json`;
}

export function imagePath(floor) {
  return `assets/floorplans/ISC-${floor}.png`;
}

// Optional site-context background. Same pixel canvas/origin as the floor
// plans, with the building footprint cut out (transparent), so it can sit
// directly beneath a floor plan at identical bounds. See landscapeLayer.js
// for why the floor plan itself needs client-side processing to reveal it.
export const LANDSCAPE_IMAGE = "assets/transparentlandscape.png";

// Point features (exits, elevators, restrooms, cafes, etc.) live under a
// `features` array in each floor's data/floorN.json, alongside `rooms`.
// See src/icons.js for the type -> icon registry and src/featureLayer.js
// for rendering. No separate data path needed - same file as dataPath().

// Feature icons are fixed-pixel L.divIcon markers (see featureLayer.js),
// not part of the CRS.Simple pixel canvas, so they don't scale with zoom
// the way room polygons/the floor plan image do. To keep them reading as
// "roughly the same size relative to the rooms" without letting them
// shrink to illegible specks at the zoomed-out reset view or balloon into
// blobs at max zoom, main.js interpolates their CSS scale linearly across
// the *current* map's actual zoom range (map.getMinZoom() -> maxZoom),
// not a hardcoded absolute zoom number. Using the live min/maxZoom instead
// of fixed values means this keeps working correctly as minZoom moves
// with viewport size (see updateMinZoom() in main.js).
export const ICON_MIN_SCALE = 0.65; // size at map.getMinZoom() (the reset/fit view)
export const ICON_MAX_SCALE = 1;    // size at map.getMaxZoom() (32px native)
