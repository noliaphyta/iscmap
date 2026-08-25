import { styleForCategory } from "./mapConfig.js";
import { polygonToLatLngs, pixelToLatLng } from "./pixelCRS.js";
import { iconPathFor } from "./icons.js";

// Rest/active polygon styles - rest is outline-only (near-transparent
// fill) so the category color doesn't overpower the map; the fill only
// appears on hover, or permanently for the click-selected room.
const REST_STYLE = { weight: 1, fillOpacity: 0.35 };
const ACTIVE_STYLE = { weight: 3, fillOpacity: 0.75 };

// Area-weighted polygon centroid - a plain vertex average misplaces labels
// on L-shaped/notched rooms (pulls them toward whichever corner has more
// vertices instead of the room's actual visual center), which this data
// has plenty of.
function centroid(ring) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area *= 0.5;
  if (Math.abs(area) < 1e-6) {
    // Degenerate polygon (zero area) - fall back to a vertex average
    // rather than dividing by ~zero.
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function ringBbox(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

// Room-number labels/icons are drawn in the map's own pixel/world space
// (like the room polygons) rather than as fixed-screen-size markers, so
// they grow and shrink with the room the same way its polygon does. Since
// Leaflet markers don't natively do that, each label marker is rendered at
// a fixed anchor point and its on-screen pixel size is recomputed on every
// zoom change: worldSize (in geojson coordinate units) * pixelsPerUnit
// (how many screen px one geojson unit currently spans).
let labelEntries = []; // { textEl, iconEl, worldFont, worldIcon }
let zoomHandlerMap = null; // the map a zoom listener has already been attached to

function pixelsPerUnit(map) {
  // Measuring two points 100 world-units apart (rather than 1) keeps this
  // accurate at extreme zoom levels where a 1-unit gap could round away to
  // the same screen pixel.
  const p0 = map.latLngToContainerPoint(pixelToLatLng(0, 0));
  const p1 = map.latLngToContainerPoint(pixelToLatLng(100, 0));
  return (p1.x - p0.x) / 100;
}

function rescaleLabels(map) {
  const scale = pixelsPerUnit(map);
  for (const entry of labelEntries) {
    entry.textEl.style.fontSize = `${entry.worldFont * scale}px`;
    if (entry.iconEl) {
      const px = entry.worldIcon * scale;
      entry.iconEl.style.width = `${px}px`;
      entry.iconEl.style.height = `${px}px`;
    }
  }
}

// Renders every given feature (already filtered to "current level, both
// buildings" by the caller) as a room polygon + label/icon marker into
// layerGroup. Features with null geometry are skipped entirely - they
// still exist for search, they just can't be drawn (see geoData.js).
//
// Returns a Map of space_id -> L.polygon so the caller can drive selection
// (see selectRoom below) after a search result or click.
export function renderRooms(map, layerGroup, features, { onRoomClick } = {}) {
  labelEntries = [];
  const polyById = new Map();

  // Polygon outline reads the live --ink custom property rather than a
  // literal black, so it stays visible against both the light and dark
  // themes (a fixed black outline all but disappears against the dark
  // theme's near-black map background). renderRooms re-runs on every
  // floor switch and on theme toggle (see main.js), so this always
  // reflects whichever theme is active.
  const strokeColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--ink")
    .trim() || "#000000";

  for (const feature of features) {
    if (!feature.geometry) continue;
    const props = feature.properties;
    const ring = feature.geometry.coordinates[0];
    const style = styleForCategory(props.Category);

    const polygon = L.polygon(polygonToLatLngs(ring), {
      color: strokeColor,
      fillColor: style.fill,
      className: "room-polygon",
      ...REST_STYLE,
    });
    polygon.on("mouseover", () => {
      if (props.space_id !== selectedSpaceId) polygon.setStyle(ACTIVE_STYLE);
    });
    polygon.on("mouseout", () => {
      if (props.space_id !== selectedSpaceId) polygon.setStyle(REST_STYLE);
    });
    polygon.on("click", () => {
      selectRoom(polyById, props.space_id);
      if (onRoomClick) onRoomClick(props);
    });
    polygon.addTo(layerGroup);
    polyById.set(props.space_id, polygon);

    // --- label + icon, anchored at the area-weighted centroid ---
    const [cx, cy] = centroid(ring);
    const bb = ringBbox(ring);
    const roomSize = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);

    const iconPath = iconPathFor(props.Category, props.SubCategory);
    const hasIcon = Boolean(iconPath) && roomSize > 3;
    const worldIcon = hasIcon ? Math.max(2.2, Math.min(roomSize * 0.28, 7)) : 0;
    const worldFont = Math.max(1.1, Math.min(roomSize * 0.09, 2.4));

    const marker = L.marker(pixelToLatLng(cx, cy), {
      // iconSize [0,0] + the wrapper's own translate(-50%,-50%) (see
      // styles/main.css .room-label-marker) decouples sizing entirely from
      // Leaflet's icon box model - we're driving pixel size ourselves via
      // rescaleLabels() above, not through iconSize/iconAnchor.
      icon: L.divIcon({
        className: "room-label-marker",
        html: `
          <div class="room-label-inner">
            ${hasIcon ? `<img class="room-icon" src="${iconPath}" alt="" draggable="false" />` : ""}
            <span class="room-number-label">${props.room_number || ""}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      keyboard: false,
    });
    marker.addTo(layerGroup);

    const el = marker.getElement();
    if (el) {
      labelEntries.push({
        textEl: el.querySelector(".room-number-label"),
        iconEl: hasIcon ? el.querySelector(".room-icon") : null,
        worldFont,
        worldIcon,
      });
    }
  }

  rescaleLabels(map);
  if (zoomHandlerMap !== map) {
    map.on("zoom zoomend", () => rescaleLabels(map));
    zoomHandlerMap = map;
  }

  return polyById;
}

// --- selection (search result or click) ---------------------------------
let selectedSpaceId = null;
let selectedPolygon = null;

export function selectRoom(polyById, spaceId) {
  if (selectedPolygon) selectedPolygon.setStyle(REST_STYLE);
  selectedSpaceId = spaceId;
  selectedPolygon = polyById.get(spaceId) || null;
  if (selectedPolygon) selectedPolygon.setStyle(ACTIVE_STYLE);
}

export function clearSelection() {
  selectedSpaceId = null;
  selectedPolygon = null;
}
