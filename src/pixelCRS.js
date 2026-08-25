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

export function polygonToLatLngs(polygon) {
  return polygon.map(([x, y]) => pixelToLatLng(x, y));
}

// Bounds are no longer derived from a PNG's pixel dimensions (there's no
// image anymore) - they're computed from the data itself: the bounding box
// of every polygon ring across a set of geojson features. Features with
// null geometry (see roomLayer.js/geoData.js) are simply skipped here;
// they contribute no shape to fit/zoom against.
export function boundsForFeatures(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;

  for (const feature of features) {
    if (!feature.geometry) continue;
    for (const [x, y] of feature.geometry.coordinates[0]) {
      any = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!any) return null;
  return L.latLngBounds(pixelToLatLng(minX, minY), pixelToLatLng(maxX, maxY));
}
