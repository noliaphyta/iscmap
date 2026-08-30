import { GEOJSON_PATH } from "./libraryConfig.js";

// Unlike ISC's two buildings (src/geoData.js), the library is a single
// building, so there's no cross-building canonicalization to do - every
// floor_label maps to exactly one button. But its floor_labels don't fit
// ISC's "...FloorN" regex either (fetch_all_floors_final.py named them
// Library_Basement/Library_Plant/Library_Penthouse, not Library_FloorB/
// Library_FloorP/...), so this is an explicit table rather than a
// pattern match. Order here is top-to-bottom in the physical building
// (Penthouse/roof down to Basement) and doubles as the elevator-panel
// button order (src/floorControl.js renders `levels` top-first as given).
const LEVELS = [
  { floorLabel: "Library_Penthouse", level: "PH", name: "Penthouse" },
  { floorLabel: "Library_Plant", level: "P", name: "Plant" },
  { floorLabel: "Library_Floor3", level: "3", name: "Floor 3" },
  { floorLabel: "Library_Floor2", level: "2", name: "Floor 2" },
  { floorLabel: "Library_Floor1", level: "1", name: "Floor 1" },
  { floorLabel: "Library_Basement", level: "B", name: "Basement" },
];
const LEVEL_BY_LABEL = new Map(LEVELS.map((l) => [l.floorLabel, l.level]));
const LABEL_BY_LEVEL = new Map(LEVELS.map((l) => [l.level, l.floorLabel]));

// Mirrors src/geoData.js's levelOf/canonicalLevel signatures so
// src/search.js (which calls both to render "ROOM — Floor X" and to
// resolve which floor a result lives on) works unmodified against
// either building's geoData module.
function levelOf(floorLabel) {
  return LEVEL_BY_LABEL.get(floorLabel) || null;
}
function canonicalLevel(level) {
  return level; // no cross-building merge needed for a single building
}

// Fetches data/library.geojson once and builds the indexes src/main.js /
// src/libraryMain.js need - same shape as src/geoData.js's loadGeoData
// (allLevels, featuresForLevel, searchIndex, canonicalLevel, levelOf) so
// src/libraryMain.js can drive the same UI modules (floorControl,
// search, roomLayer) as the ISC page without any of those modules
// needing to know which building they're rendering.
export async function loadGeoData() {
  const res = await fetch(GEOJSON_PATH);
  if (!res.ok) {
    throw new Error(`Failed to load ${GEOJSON_PATH}: ${res.status}`);
  }
  const geojson = await res.json();
  const features = geojson.features || [];

  const featuresByLabel = {};
  for (const feature of features) {
    const { floor_label } = feature.properties;
    (featuresByLabel[floor_label] ||= []).push(feature);
  }

  // Only include levels actually present in the data, still in the
  // fixed top-to-bottom order above (not the data's own key order).
  const allLevels = LEVELS.map((l) => l.level).filter((level) =>
    Object.prototype.hasOwnProperty.call(featuresByLabel, LABEL_BY_LEVEL.get(level))
  );

  function featuresForLevel(level) {
    const label = LABEL_BY_LEVEL.get(level);
    return (label && featuresByLabel[label]) || [];
  }

  const searchIndex = features.filter((f) => f.properties.room_number);

  return { features, allLevels, featuresForLevel, searchIndex, canonicalLevel, levelOf };
}
