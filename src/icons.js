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

// Resolves the icons/ path for a room, or null if none applies.
export function iconPathFor(category, subCategory) {
  const subKey = (subCategory || "").trim().toLowerCase();
  const file = SUBCATEGORY_ICON[subKey] || CATEGORY_ICON_FALLBACK[categoryKey(category)];
  return file ? `icons/${file}` : null;
}
