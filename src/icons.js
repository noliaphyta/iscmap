// Airport-style wayfinding icon registry. Icons are the AIGA-style SVGs in
// /icons (referenced by path, not inlined) so they stay easy to swap.
//
// Most feature types map to a single fixed icon. "exit" is special: it maps
// to one of six directional arrow icons depending on the feature's
// `direction` field, the same way airport exit signage points toward the
// nearest door rather than using a static door glyph.

export const EXIT_ARROW_ICON = {
  up:          "icons/uparrow.svg",
  down:        "icons/down-arrow.svg",
  left:        "icons/leftarrow.svg",
  right:       "icons/right-arrow.svg",
  "down-left": "icons/left-and-down-arrow.svg",
  "down-right":"icons/right-and-down-arrow.svg",
};

// icon: fixed path, or null when the type needs iconFor() (direction-based).
export const FEATURE_TYPES = {
  exit:              { label: "Exit",           icon: null },
  elevator:          { label: "Elevator",       icon: "icons/elevator.svg" },
  stairs:            { label: "Stairs",         icon: "icons/stairs.svg" },
  restroom:          { label: "Restroom",       icon: "icons/toilets.svg" },
  cafe:              { label: "Café",           icon: "icons/coffee-shop.svg" },
  restaurant:        { label: "Restaurant",     icon: "icons/restaurant.svg" },
  study:             { label: "Study Room",     icon: "icons/waitingroom.svg" },
  information:       { label: "Information",    icon: "icons/information.svg" },
  "lost-and-found":  { label: "Lost & Found",   icon: "icons/lostandfound.svg" },
  "fire-extinguisher":{ label: "Fire Extinguisher", icon: "icons/fireextinguisher.svg" },
};

// Resolves the actual icon path for a feature, handling the exit/direction
// case. Falls back to the "up" arrow if an exit is missing/has an unknown
// direction, so a bad direction value never breaks rendering.
export function iconFor(feature) {
  const type = FEATURE_TYPES[feature.type];
  if (!type) return null;
  if (feature.type === "exit") {
    return EXIT_ARROW_ICON[feature.direction] || EXIT_ARROW_ICON.up;
  }
  return type.icon;
}

export function labelFor(feature) {
  return FEATURE_TYPES[feature.type]?.label || feature.type;
}
