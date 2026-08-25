// Central place to declare app-wide constants. Floors/buildings are no
// longer declared here (they used to be a hardcoded FLOORS array) - they're
// now derived at runtime from data/rooms.geojson's floor_label values by
// src/geoData.js, so a new building or floor "just appears" the next time
// the geojson is regenerated, no code change required here.

// Single source of truth for room data: every building, every floor, real
// polygon geometry + room number + category/subcategory, replacing the old
// three-parallel-systems setup (OCR labels, color-probe, unverified traced
// polygons). See src/geoData.js for how this file is loaded and indexed.
export const GEOJSON_PATH = "data/rooms.geojson";

// Palette matches the "Space Category" legend key. Colors are a more
// aesthetic, harmonized re-interpretation of the key's swatches (which are
// plain default pastels) - tuned to sit well against the black-outline,
// poster-style site theme while staying distinguishable at small polygon
// sizes. Keys match the geojson's `Category` property 1:1 once run through
// categoryKey() below (trim, lowercase, spaces -> hyphens) - e.g.
// "Laboratory Facilities" -> "laboratory-facilities".
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

// Fallback style for any room whose category isn't recognized above
// (including the empty-string Category some rows have).
export const DEFAULT_CATEGORY_STYLE = CATEGORY_STYLE["no-value"];

// Normalizes a geojson `Category` string into a CATEGORY_STYLE key, rather
// than hand-mapping every string variant. "" / null / undefined -> the
// same "no-value" bucket as an unrecognized value, since both mean "no
// useful category to show."
export function categoryKey(category) {
  if (!category) return "no-value";
  const key = category.trim().toLowerCase().replace(/\s+/g, "-");
  return key in CATEGORY_STYLE ? key : "no-value";
}

export function styleForCategory(category) {
  return CATEGORY_STYLE[categoryKey(category)] || DEFAULT_CATEGORY_STYLE;
}
