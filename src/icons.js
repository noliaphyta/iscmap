import { categoryKey } from "./mapConfig.js";

// oldmap's icons/ folder was built for manually-placed point features
// (exit, elevator, stairs, restroom, cafe, etc.), not room categories. The
// geojson has no equivalent point-feature array, so icons are inferred
// from room data and auto-placed at each room's centroid (see
// roomLayer.js) instead of being separately authored.
//
// Category alone is too coarse - restrooms, for example, are
// Category: "Building Services" / SubCategory: "Public Rest Room", so
// matching on Category alone misses them entirely. SubCategory is checked
// first, since it's what actually corresponds to a real-world room type;
// Category-level fallback only applies where no subcategory signal exists.
//
// Rooms whose SubCategory/Category don't match anything below get no icon
// - color + room number only. That's deliberate: a weak/misleading icon on
// an office or generic storage room is worse than none.
const SUBCATEGORY_ICON = {
  "public rest room":                        "toilets.svg",
  "stairway":                                 "stairs.svg",
  "elevator":                                 "elevator.svg",
  "food facility":                            "restaurant.svg",
  "lounge":                                   "coffee-shop.svg",
  "study space":                              "waitingroom.svg",
  "hazardous materials storage":              "fireextinguisher.svg",
  "hazardous waste storage":                  "fireextinguisher.svg",
  "central computer or telecommunications":   "information.svg",
  "lobby":                                    "information.svg",
};

// Category-level fallback, only consulted when SubCategory doesn't match
// anything above (e.g. missing/blank SubCategory).
const CATEGORY_ICON_FALLBACK = {
  "study-facilities": "waitingroom.svg", // old FEATURE_TYPES label was literally "Study Room"
};

// The full picklist offered by the standalone annotation tool
// (tools/annotate.html) for manually-placed notes/wayfinding markers -
// this is closer to what this folder was originally built for (see the
// top-of-file comment) than the auto-inferred room icons above are.
// Exported from here rather than kept local to annotateMain.js so
// src/annotations.js (which validates a *committed, publicly-served*
// data/annotations.json before rendering it - see that file) checks
// against the exact same list the authoring tool offers, instead of a
// second hand-maintained copy that could quietly drift out of sync.
// Add a new icons/*.svg file to the picklist by adding it here once,
// not in two places.
export const NOTE_ICONS = [
  "down-arrow.svg", "uparrow.svg", "leftarrow.svg", "right-arrow.svg",
  "left-and-down-arrow.svg", "right-and-down-arrow.svg",
  "forward-and-left-arrow.svg", "forward-and-right-arrow.svg",
  "marker-circle.svg", "information.svg", "stairs.svg", "elevator.svg",
  "toilets.svg", "restaurant.svg", "coffee-shop.svg", "waitingroom.svg",
  "fireextinguisher.svg", "lostandfound.svg",
];

// Resolves the icons/ path for a room, or null if none applies.
export function iconPathFor(category, subCategory) {
  const subKey = (subCategory || "").trim().toLowerCase();
  const file = SUBCATEGORY_ICON[subKey] || CATEGORY_ICON_FALLBACK[categoryKey(category)];
  return file ? `icons/${file}` : null;
}
