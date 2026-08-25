import { GEOJSON_PATH } from "./mapConfig.js";

// Parses a floor_label like "Building1_FloorB" or "Building2_Floor0" into
// its raw level token ("B" or "0".."4"). Deliberately regex-driven rather
// than a hardcoded floor list, so a new floor in the data "just works."
function levelOf(floorLabel) {
  const m = floorLabel.match(/Floor([A-Za-z]|\d+)$/);
  return m ? m[1] : null;
}

// Known data quirk: Building 1's basement is labeled "FloorB", Building 2's
// is labeled "Floor0" - same physical level, different label. Canonicalize
// both to "B" so they collapse into a single floor button instead of
// showing as two separate basements.
function canonicalLevel(rawLevel) {
  return rawLevel === "0" ? "B" : rawLevel;
}

// Sort key for the elevator-panel button order: basement lowest, then
// numeric floors ascending. Consumers reverse this for top-first display.
function levelSortKey(level) {
  return level === "B" ? -1 : parseInt(level, 10);
}

// Fetches data/rooms.geojson once and builds every index the app needs:
//   - featuresByBuilding[buildingId][floor_label] -> features[]
//   - allLevels: canonical levels present across *either* building, sorted
//     top-first (e.g. ["4","3","2","1","B"])
//   - searchIndex: every feature with a non-empty room_number, regardless
//     of whether geometry is null (a null-geometry room is still a valid,
//     if unzoomable, search result - see final_map_build_prompt.md)
export async function loadGeoData() {
  const res = await fetch(GEOJSON_PATH);
  if (!res.ok) {
    throw new Error(`Failed to load ${GEOJSON_PATH}: ${res.status}`);
  }
  const geojson = await res.json();
  const features = geojson.features || [];

  const featuresByBuilding = {};
  for (const feature of features) {
    const { building_id, floor_label } = feature.properties;
    (featuresByBuilding[building_id] ||= {});
    (featuresByBuilding[building_id][floor_label] ||= []).push(feature);
  }
  const buildingIds = Object.keys(featuresByBuilding).sort();

  const allLevels = Array.from(
    new Set(
      buildingIds.flatMap((bid) =>
        Object.keys(featuresByBuilding[bid]).map((label) => canonicalLevel(levelOf(label)))
      )
    )
  ).sort((a, b) => levelSortKey(b) - levelSortKey(a));

  // Given a canonical level, finds each building's actual floor_label for
  // it (may differ per building, e.g. "FloorB" vs "Floor0"), so callers
  // can look up featuresByBuilding[bid][thatLabel] directly.
  function floorLabelFor(buildingId, canonicalLvl) {
    const labels = Object.keys(featuresByBuilding[buildingId] || {});
    return labels.find((label) => canonicalLevel(levelOf(label)) === canonicalLvl) || null;
  }

  // Every feature across both buildings for a given canonical level -
  // this is what "both buildings always render together, on one shared
  // floor control" means in practice.
  function featuresForLevel(canonicalLvl) {
    return buildingIds.flatMap((bid) => {
      const label = floorLabelFor(bid, canonicalLvl);
      return label ? featuresByBuilding[bid][label] : [];
    });
  }

  const searchIndex = features.filter((f) => f.properties.room_number);

  return { features, buildingIds, allLevels, featuresForLevel, searchIndex, canonicalLevel, levelOf };
}
