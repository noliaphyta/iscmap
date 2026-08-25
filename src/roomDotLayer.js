import { pixelToLatLng } from "./pixelCRS.js";

// Renders the searched room's location as a single target marker.
// Replaces the old polygon renderer (roomLayer.js, no longer wired up -
// the traced polygons were inaccurate and there's no time to fix them by
// hand, see README) AND the earlier all-dots-always-visible version of
// this file. Per product decision, only the room someone searched for
// gets a marker - showing every OCR-detected label at once (a few
// hundred red dots per floor) was too noisy and looked like the floor
// plan was covered in a rash. A room's location IS the centroid of its
// detected text label - there's no other geometry backing this.
//
// Mirrors the renderFeatures() contract: returns the created layers so
// the caller can clear them when switching floors. There's at most one
// layer here (or zero, if no room is currently targeted on this floor).
export function renderRoomDots(layerGroup, floorData, { highlightId } = {}) {
  if (!highlightId) return [];

  const label = (floorData.labels || []).find((l) => l.room_number === highlightId);
  if (!label) return [];

  const divIcon = L.divIcon({
    className: "room-dot room-dot--highlighted",
    html: `<span class="room-dot__pulse"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    tooltipAnchor: [0, -10],
  });

  const marker = L.marker(pixelToLatLng(label.x, label.y), {
    icon: divIcon,
    keyboard: true,
    alt: label.room_number,
  });

  marker.bindTooltip(label.room_number, { direction: "top", permanent: true });
  marker.addTo(layerGroup);
  marker.openTooltip();

  return [marker];
}
