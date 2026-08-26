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
// Assignment follows the Brand Hub's usage rules, weighted against how
// much of the actual floor-plan area each category covers (see
// data/rooms.geojson):
//   - Office Facilities + Circulation (~46% of rooms) get literal Primary
//     Palette colors (W&M Green, W&M Silver) - the two biggest categories
//     carry the brand's core identity.
//   - Laboratory Facilities, Building Services, Mechanical, and Support
//     (~44% combined) get Secondary Greens. The Brand Hub describes these
//     as part of the Primary system ("supported by a secondary set of
//     complementary greens"), so combined with the above this keeps the
//     map's dominant impression solidly green - comfortably within/above
//     the "70-80% Primary Palette" guideline.
//   - The remaining low-frequency categories (General Use, Special Use,
//     Classroom Facilities, Study Facilities - ~9.5% combined) get
//     Tertiary Palette colors for maximum visual distinction where it's
//     needed most (small floor-plan footprints), while staying under the
//     Brand Hub's 10-15% ceiling on Tertiary usage.
// W&M Gold and Spirit Gold are both deliberately unused here: Gold is
// reserved for genuine brand moments rather than a room-category fill,
// and mixing it with Spirit Gold is explicitly against brand rules.
export const CATEGORY_STYLE = {
  // --- Primary Palette (dominant categories) ---
  "office-facilities":    { fill: "#004E38", label: "Office Facilities" },    // W&M Green
  "circulation":           { fill: "#D8DCDB", label: "Circulation" },          // W&M Silver

  // --- Secondary Greens (part of the Primary system) ---
  "laboratory-facilities":{ fill: "#76A190", label: "Laboratory Facilities" },// Patina
  "building-services":    { fill: "#28463D", label: "Building Services" },    // Griffin Green
  "mechanical":            { fill: "#00231B", label: "Mechanical" },           // Dark Green
  "support":               { fill: "#789D4A", label: "Support" },              // Moss

  // --- Tertiary Palette (used sparingly, smallest-footprint categories) ---
  "general-use":           { fill: "#964A37", label: "General Use" },          // Brick Red
  "special-use":           { fill: "#673E65", label: "Special Use" },          // Royal Purple
  "classroom-facilities":  { fill: "#00677E", label: "Classroom Facilities" }, // Marine Blue
  "study-facilities":      { fill: "#85B8C7", label: "Study Facilities" },     // River Blue
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
