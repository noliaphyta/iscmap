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

// Palette pulled from the W&M Brand Hub (wm.edu/brand/visual-brand/color-
// palette), not arbitrary pastels, so the map reads as on-brand rather
// than a generic data-viz key. Keys match the geojson's `Category`
// property 1:1 once run through categoryKey() below (trim, lowercase,
// spaces -> hyphens) - e.g. "Laboratory Facilities" -> "laboratory-
// facilities".
//
// Assignment prioritizes perceptual distinction between adjacent room
// polygons over strict palette-tier grouping (revised from an earlier
// version that clustered too many categories into near-identical dark
// greens). Colors are still sourced only from the Brand Hub palette, and
// every design still includes W&M Green (Office Facilities) or W&M Gold
// (Building Services), satisfying the Brand Hub's "never omit Green or
// Gold" rule. Spirit Gold is deliberately unused so it's never paired
// with W&M Gold in the same composition, per the Brand Hub's explicit
// restriction.
export const CATEGORY_STYLE = {
  // --- Primary Palette ---
  "office-facilities":    { fill: "#004E38", label: "Office Facilities" },    // W&M Green
  "circulation":           { fill: "#D8DCDB", label: "Circulation" },          // W&M Silver

  // --- Secondary Greens ---
  "support":               { fill: "#789D4A", label: "Support" },              // Moss
  "special-use":           { fill: "#B8DDB1", label: "Special Use" },          // Sage

  // --- Tertiary Palette ---
  "laboratory-facilities":{ fill: "#00677E", label: "Laboratory Facilities" },// Marine Blue
  "building-services":    { fill: "#846838", label: "Building Services" },    // W&M Gold (ADA)
  "mechanical":            { fill: "#06263B", label: "Mechanical" },           // Midnight Blue
  "general-use":           { fill: "#964A37", label: "General Use" },          // Brick Red
  "classroom-facilities":  { fill: "#85B8C7", label: "Classroom Facilities" }, // River Blue
  "study-facilities":      { fill: "#76A190", label: "Study Facilities" },     // Patina
};

// Unclassified rooms (empty/unrecognized Category) render with no fill at
// all - just the standard outline - rather than a dedicated "No Value"
// swatch. A blank room reads as self-evidently uncategorized, so it
// doesn't need a color or a legend entry to explain it; deliberately kept
// out of CATEGORY_STYLE so the legend (src/legend.js, which iterates
// CATEGORY_STYLE directly) never shows it as a category.
export const DEFAULT_CATEGORY_STYLE = { fill: "transparent", label: "Unclassified" };

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
