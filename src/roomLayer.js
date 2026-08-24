import { CATEGORY_STYLE, DEFAULT_CATEGORY_STYLE } from "./mapConfig.js";
import { polygonToLatLngs } from "./pixelCRS.js";

// Renders one floor's rooms as Leaflet polygons on the given layer group.
// Returns the created layers so the caller can clear them when switching
// floors.
export function renderRooms(layerGroup, floorData, { onRoomClick, highlightId }) {
  const created = [];

  for (const room of floorData.rooms || []) {
    const style = CATEGORY_STYLE[room.category] || DEFAULT_CATEGORY_STYLE;
    const isHighlighted = highlightId && room.id === highlightId;

    // Rest state is outline-only (near-transparent fill) so the category
    // color doesn't fight with the floor plan image's own room colors.
    // The fill only appears on hover/click, or permanently for a
    // search-highlighted room.
    const restStyle = { weight: 1, fillOpacity: 0.06 };
    const activeStyle = { weight: 3, fillOpacity: 0.6 };

    const polygon = L.polygon(polygonToLatLngs(room.polygon), {
      color: "#000000",
      fillColor: style.fill,
      className: "room-polygon",
      ...(isHighlighted ? activeStyle : restStyle),
    });

    polygon.bindTooltip(room.id, { sticky: true, direction: "top" });
    polygon.on("click", () => onRoomClick(room));

    if (!isHighlighted) {
      polygon.on("mouseover", () => polygon.setStyle(activeStyle));
      polygon.on("mouseout", () => polygon.setStyle(restStyle));
    }

    polygon.addTo(layerGroup);
    created.push(polygon);

    if (isHighlighted) {
      polygon.openTooltip();
    }
  }

  return created;
}
