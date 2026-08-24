// Leaflet's CRS.Simple treats coordinates as a flat plane (no earth
// projection) which is exactly what an indoor floor plan needs.
// Leaflet's y-axis increases upward, but image pixel y increases downward,
// so we negate y everywhere. These two helpers are the only place that
// conversion happens - everything else just works in "pixel space".

export function pixelToLatLng(x, y) {
  return L.latLng(-y, x);
}

export function latLngToPixel(latlng) {
  return { x: latlng.lng, y: -latlng.lat };
}

export function imageBounds(width, height) {
  return [pixelToLatLng(0, 0), pixelToLatLng(width, height)];
}

export function polygonToLatLngs(polygon) {
  return polygon.map(([x, y]) => pixelToLatLng(x, y));
}
