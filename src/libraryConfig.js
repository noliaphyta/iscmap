// Library-page counterpart to mapConfig.js's data paths. Category colors
// (CATEGORY_STYLE / styleForCategory) are deliberately NOT duplicated here
// - src/roomLayer.js and src/legend.js import those directly from
// mapConfig.js, since FAMIS's Category/SubCategory values (and therefore
// the W&M-brand palette assigned to them) are shared across every
// building's data, not something that varies per building.

// Swem Library's own room geojson (fetch_all_floors_final.py output for
// mapid 434, all 6 floors combined) - kept as a separate file from
// data/rooms.geojson (ISC) rather than merged into it, since the two
// buildings are shown on separate pages with their own floor stacks
// (see src/libraryGeoData.js) rather than one shared control like ISC's
// two buildings.
export const GEOJSON_PATH = "data/library.geojson";

// Separate published-annotations file so publishing a color override or
// note for the library never touches (or gets clobbered by) ISC's
// data/annotations.json. Same "missing file = nothing published yet"
// handling as ISC - see src/annotations.js's loadPublishedAnnotations.
export const ANNOTATIONS_PATH = "data/library-annotations.json";
