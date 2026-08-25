import { pixelToLatLng } from "./pixelCRS.js";

// The site-landscape.png is drawn with the building footprints cut out
// (fully transparent), so laying it *behind* the room polygons makes the
// landscape read as context around whatever floor is currently rendered,
// with the rooms showing through the transparent gap.
//
// The image isn't in the same pixel space as data/rooms.geojson - it's a
// much higher-resolution site render (4000x3297px) rather than a 1:1
// tracing source. ANCHOR_X/ANCHOR_Y/SCALE below convert the image's own
// pixel coordinates into the app's CRS.Simple pixel space. They were
// derived by matching the image's transparent void (bbox ~[944,1005] to
// [3868,2517] in image px) to rooms.geojson's combined bounding box
// (~[304,10] to [884,309] in app units) - the two axes agreed on scale to
// within 0.3%, which is a good sign the alignment is right, but it's a
// best-fit from bounding boxes, not a calibrated tie-point, so nudge these
// three numbers if it's visibly off once you see it rendered:
//   - ANCHOR_X / ANCHOR_Y: app-space position of the image's top-left corner (0,0)
//   - SCALE: app units per image pixel (same value used for both axes,
//     since the image shouldn't need independent x/y stretching)
const IMAGE_PATH = "assets/site-landscape.png";
const IMAGE_WIDTH_PX = 4000;
const IMAGE_HEIGHT_PX = 3297;
const ANCHOR_X = 116.96;
const ANCHOR_Y = -189.28;
const SCALE = 0.19799;

export function addBackgroundImage(map) {
  // A dedicated pane pinned below Leaflet's default overlayPane (z-index
  // 400, where the room polygons live) guarantees the image stays behind
  // them regardless of DOM/add order - including across floor switches,
  // which clear and re-add the room layer group.
  if (!map.getPane("background")) {
    map.createPane("background");
    map.getPane("background").style.zIndex = 150;
  }

  const topLeft = pixelToLatLng(ANCHOR_X, ANCHOR_Y);
  const bottomRight = pixelToLatLng(
    ANCHOR_X + IMAGE_WIDTH_PX * SCALE,
    ANCHOR_Y + IMAGE_HEIGHT_PX * SCALE
  );
  const bounds = L.latLngBounds(topLeft, bottomRight);

  // An imageOverlay is geo-referenced (not a screen-fixed element), so it
  // pans/zooms with the map automatically - no extra wiring needed for
  // "zoomed with it".
  return L.imageOverlay(IMAGE_PATH, bounds, { pane: "background" }).addTo(map);
}
