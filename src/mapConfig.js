// Central place to declare what floors exist.
// To add a real floor: drop the image in assets/floorplans/ as ISC-N.png,
// add data/floorN.json (see tools/polygon-editor.html to trace room
// polygons), then list the floor number in FLOORS below.

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
