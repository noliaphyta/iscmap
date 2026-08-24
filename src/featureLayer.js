import { pixelToLatLng } from "./pixelCRS.js";
import { iconFor, labelFor } from "./icons.js";

// Renders one floor's point features (exits, elevators, restrooms, cafes,
// etc.) as fixed-size Leaflet markers. Unlike room polygons these use
// L.divIcon so they stay a constant pixel size on screen at every zoom
// level, the way real wayfinding pictograms would.
//
// Returns the created layers so the caller can clear them when switching
// floors, matching the renderRooms() contract in roomLayer.js.
export function renderFeatures(layerGroup, floorData, { onFeatureClick } = {}) {
  const created = [];

  for (const feature of floorData.features || []) {
    const iconPath = iconFor(feature);
    if (!iconPath) {
      console.warn(`Unknown feature type "${feature.type}" for ${feature.id}, skipping.`);
      continue;
    }

    // The outer element (className) is the exact DOM node Leaflet writes its
    // positioning transform to on every pan/zoom - it must stay untouched
    // (no transform of our own) or it fights with Leaflet's translate3d.
    // The visual box + zoom-responsive scaling live on the nested
    // .feature-icon-inner element instead. See styles/main.css.
    const divIcon = L.divIcon({
      className: "feature-icon-badge",
      html: `<div class="feature-icon-inner"><img src="${iconPath}" alt="${labelFor(feature)}" draggable="false" /></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      tooltipAnchor: [0, -16],
    });

    const [x, y] = feature.point;
    const marker = L.marker(pixelToLatLng(x, y), {
      icon: divIcon,
      keyboard: true,
      alt: labelFor(feature),
    });

    marker.bindTooltip(labelFor(feature), { direction: "top" });
    if (onFeatureClick) {
      marker.on("click", () => onFeatureClick(feature));
    }

    marker.addTo(layerGroup);
    created.push(marker);
  }

  return created;
}
