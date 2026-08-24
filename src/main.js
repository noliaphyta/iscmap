import { dataPath, imagePath, LANDSCAPE_IMAGE, ICON_MIN_SCALE, ICON_MAX_SCALE } from "./mapConfig.js";
import { imageBounds, latLngToPixel } from "./pixelCRS.js";
import { renderRooms } from "./roomLayer.js";
import { renderFeatures } from "./featureLayer.js";
import { labelFor } from "./icons.js";
import { createControlPanel } from "./floorControl.js";
import { createLegend } from "./legend.js";
import { buildSearchIndex, createSearchBox } from "./search.js";
import { getTransparentFloorImage } from "./landscapeLayer.js";
import { getFloorPixelData, matchCategoryAt } from "./colorProbe.js";

// Room polygons aren't traced yet (see README "Known limitations") - every
// floor's `rooms` array is currently empty, so this is a no-op today, but
// flip this back on the moment real polygons land rather than deleting the
// call. Until then, src/colorProbe.js stands in for category detection.
const ROOMS_ENABLED = false;

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -4, // conservative fallback until the first floor's bounds set the real limit below
  maxZoom: 3,
  zoomSnap: 0.25,
  attributionControl: false,
});

let currentImageLayer = null;
let currentLandscapeLayer = null;
let currentRoomLayerGroup = L.layerGroup().addTo(map);
let currentFeatureLayerGroup = L.layerGroup().addTo(map);
let currentFloor = 2;
let hasFit = false;
let pendingHighlight = null; // room id to highlight after the next load
let currentBounds = null; // bounds of the floor currently on screen, for the reset-view button
let currentRawImageSrc = null; // last floor's plain image src, so the landscape toggle can re-render without a refetch
let showLandscape = true; // on by default - the site context reads better than a bare white background

// Every floor plan (and the landscape backdrop) shares the same pixel
// canvas/origin, so bounds are identical regardless of floor or landscape
// toggle - zooming out past the point where those bounds fill the view
// just exposes empty space beyond the artwork. getBoundsZoom(bounds, false)
// is the same "tightest zoom that still shows the whole bounds" value
// fitBounds() targets, so using it as minZoom caps zoom-out right there.
// Depends on viewport size, so it's recomputed on resize too.
function updateMinZoom(bounds) {
  if (!bounds) return;
  map.setMinZoom(map.getBoundsZoom(bounds, false));
  updateIconScale(); // minZoom just moved, so the 0%-mark of the scale range moved with it
}
window.addEventListener("resize", () => updateMinZoom(currentBounds));

// Feature icons are fixed-pixel divIcon markers (see featureLayer.js), so
// they don't natively grow/shrink with the map like room polygons do.
// This linearly interpolates a CSS scale between ICON_MIN_SCALE (at
// map.getMinZoom(), i.e. the reset/fit view) and ICON_MAX_SCALE (at
// maxZoom) and writes it to a CSS custom property that styles/main.css's
// .feature-icon-inner reads. Deliberately keyed off the *live* min/maxZoom
// rather than a fixed reference zoom number: minZoom is recomputed per
// floor/viewport by updateMinZoom() above, so anchoring to it here means
// icons visibly grow across the map's whole usable zoom range instead of
// only in the last sliver before maxZoom.
//
// This can't be pure "same relative size as rooms" (that would mean
// scaling by 2^zoom, exactly like the room polygons/floor plan image do)
// because the usable zoom range easily spans 4-6 zoom levels - a true
// 2^zoom match would make icons either illegibly tiny at reset view or
// oversized at max zoom. The linear interpolation is a deliberate
// legibility trade-off: icons still grow every step you zoom in, they
// just don't grow as fast as the rooms underneath them do.
function updateIconScale() {
  const zoom = map.getZoom();
  const minZ = map.getMinZoom();
  const maxZ = map.getMaxZoom();
  // Guards the brief window before the map's initial view is set (e.g. the
  // updateMinZoom() call inside loadFloor() that runs before the first
  // fitBounds()), where getZoom() can return undefined.
  if (!Number.isFinite(zoom) || !Number.isFinite(minZ) || !Number.isFinite(maxZ)) return;
  const t = maxZ > minZ ? (zoom - minZ) / (maxZ - minZ) : 1;
  const clampedT = Math.min(1, Math.max(0, t));
  const scale = ICON_MIN_SCALE + clampedT * (ICON_MAX_SCALE - ICON_MIN_SCALE);
  map.getContainer().style.setProperty("--icon-zoom-scale", scale.toFixed(3));
}
// 'zoom' fires continuously during animated/scroll zoom (smooth scaling);
// 'zoomend' is a safety net for any programmatic zoom change that skips it.
map.on("zoom zoomend", updateIconScale);

// Swaps in the current floor's image layer, respecting the landscape
// toggle. When landscape is on, the floor plan's white background is keyed
// out to transparent (see landscapeLayer.js) so the landscape shows through;
// when off, the plain image is used as-is (cheap, no canvas work).
async function setFloorImageLayer(rawSrc, bounds) {
  currentRawImageSrc = rawSrc;

  if (currentImageLayer) map.removeLayer(currentImageLayer);
  if (currentLandscapeLayer) map.removeLayer(currentLandscapeLayer);

  if (showLandscape) {
    currentLandscapeLayer = L.imageOverlay(LANDSCAPE_IMAGE, bounds).addTo(map);
    let src = rawSrc;
    try {
      src = await getTransparentFloorImage(rawSrc);
    } catch (err) {
      console.error("Couldn't prepare transparent floor image", err);
      showError("Couldn't show the landscape background for this floor.");
    }
    // Bail out if the user toggled landscape off or switched floors while awaiting.
    if (!showLandscape || currentRawImageSrc !== rawSrc) return;
    currentImageLayer = L.imageOverlay(src, bounds).addTo(map);
  } else {
    currentImageLayer = L.imageOverlay(rawSrc, bounds).addTo(map);
  }

  currentImageLayer.once("error", () => {
    showError(`The floor plan image for floor ${currentFloor} failed to load.`);
  });
}

const panel = createControlPanel({
  onSelectFloor: (floor) => loadFloor(floor),
});
document.getElementById("controls").appendChild(panel.root);

const legend = createLegend();
document.getElementById("app").appendChild(legend.root);

const infoPanel = document.getElementById("info-panel");

// --- error banner ---
const errorBanner = document.createElement("div");
errorBanner.className = "error-banner";
errorBanner.hidden = true;
document.getElementById("app").appendChild(errorBanner);
let errorTimer = null;

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    errorBanner.hidden = true;
  }, 4000);
}

// --- reset view control ---
const resetBtn = document.createElement("button");
resetBtn.className = "reset-view-btn";
resetBtn.type = "button";
resetBtn.textContent = "RESET VIEW";
resetBtn.setAttribute("aria-label", "Reset map view");
resetBtn.addEventListener("click", () => {
  if (currentBounds) map.fitBounds(currentBounds);
});
document.getElementById("controls").appendChild(resetBtn);

// --- landscape background toggle ---
const landscapeBtn = document.createElement("button");
landscapeBtn.className = "landscape-toggle-btn";
landscapeBtn.type = "button";
landscapeBtn.textContent = "HIDE LANDSCAPE";
landscapeBtn.classList.toggle("active", showLandscape);
landscapeBtn.setAttribute("aria-pressed", String(showLandscape));
landscapeBtn.setAttribute("aria-label", "Toggle site landscape background");
landscapeBtn.addEventListener("click", async () => {
  showLandscape = !showLandscape;
  landscapeBtn.classList.toggle("active", showLandscape);
  landscapeBtn.setAttribute("aria-pressed", String(showLandscape));
  landscapeBtn.textContent = showLandscape ? "HIDE LANDSCAPE" : "SHOW LANDSCAPE";
  if (currentRawImageSrc && currentBounds) {
    await setFloorImageLayer(currentRawImageSrc, currentBounds);
  }
});
document.getElementById("controls").appendChild(landscapeBtn);

// --- color-hover category detection ---
// Stopgap for ROOMS_ENABLED === false: samples the floor plan PNG's own
// baked-in color under the cursor (desktop) or touch point (mobile) and
// shows the matching category in the same #info-panel box that used to
// show room details on click. Reverts to the empty-state message whenever
// the sample doesn't confidently match a swatch color (see
// SWATCH_MATCH_THRESHOLD) - a wrong guess is worse than no guess.
let currentPixelData = null; // { data, width, height } for the floor plan currently on screen

function updateInfoPanelFromLatLng(latlng) {
  if (ROOMS_ENABLED || !currentPixelData) return;
  const { x, y } = latLngToPixel(latlng);
  const category = matchCategoryAt(currentPixelData, x, y);
  if (!category) {
    updateInfoPanel(null);
    return;
  }
  updateInfoPanel({ category });
}

if (!ROOMS_ENABLED) {
  // Desktop: updates live as the cursor moves over the floor plan.
  map.on("mousemove", (e) => updateInfoPanelFromLatLng(e.latlng));
  map.on("mouseout", () => updateInfoPanel(null));

  // Mobile: no hover, so a tap does the same lookup and the panel sticks
  // until the next tap (mirrors the old sticky room tooltip on click).
  map.on("click", (e) => updateInfoPanelFromLatLng(e.latlng));
}

async function loadFloor(floor) {
  let res;
  try {
    res = await fetch(dataPath(floor));
  } catch (err) {
    console.error(`Network error loading floor ${floor}`, err);
    showError(`Couldn't reach the data for floor ${floor}. Check your connection and try again.`);
    return;
  }
  if (!res.ok) {
    console.error(`No data for floor ${floor}`);
    showError(`Floor ${floor} isn't available yet.`);
    return;
  }
  const data = await res.json();

  currentFloor = floor;
  panel.render(currentFloor);
  updateInfoPanel(null);

  const [width, height] = data.imageSize;
  const bounds = imageBounds(width, height);
  currentBounds = bounds;
  updateMinZoom(bounds);

  const rawSrc = data.image || imagePath(floor);
  await setFloorImageLayer(rawSrc, bounds);

  currentRoomLayerGroup.clearLayers();
  if (ROOMS_ENABLED) {
    renderRooms(currentRoomLayerGroup, data, {
      onRoomClick: (room) => updateInfoPanel(room),
      highlightId: pendingHighlight,
    });
  } else {
    currentPixelData = null;
    updateInfoPanel(null);
    getFloorPixelData(rawSrc)
      .then((pixelData) => {
        // Bail out if the user already switched floors while this was loading.
        if (currentRawImageSrc === rawSrc) currentPixelData = pixelData;
      })
      .catch((err) => {
        console.error(`Couldn't prepare color-probe data for floor ${floor}`, err);
      });
  }

  currentFeatureLayerGroup.clearLayers();
  renderFeatures(currentFeatureLayerGroup, data, {
    onFeatureClick: (feature) => updateInfoPanel(feature),
  });

  // Only fit the view on first load - once someone is panned/zoomed in,
  // switching floors shouldn't reset them.
  if (!hasFit) {
    map.fitBounds(bounds);
    hasFit = true;
  }

  pendingHighlight = null;
}

// Handles room polygons (category + id), point features (type field), and
// the color-hover stopgap (category only, no id yet - see
// updateInfoPanelFromLatLng) since any of the three can populate this panel.
function updateInfoPanel(item) {
  if (!item) {
    infoPanel.innerHTML = `<p class="info-empty">Click a room to see details here.</p>`;
    return;
  }
  if (item.category && item.id) {
    infoPanel.innerHTML = `
      <h3>${item.id}</h3>
      <p class="info-category">${item.category.replace(/-/g, " ")}</p>
    `;
    return;
  }
  if (item.category) {
    infoPanel.innerHTML = `
      <h3>${item.category.replace(/-/g, " ")}</h3>
      <p class="info-category">Category detected from floor plan color</p>
    `;
    return;
  }
  infoPanel.innerHTML = `
    <h3>${labelFor(item)}</h3>
    <p class="info-category">${item.id}</p>
  `;
}

// --- search wiring ---
buildSearchIndex().then((index) => {
  const searchBox = createSearchBox({
    index,
    onSelect: (match) => {
      pendingHighlight = match.id;
      loadFloor(match.floor).then(() => {
        const layer = currentRoomLayerGroup
          .getLayers()
          .find((l) => l.getTooltip && l.getTooltip()?.getContent() === match.id);
        if (layer) map.fitBounds(layer.getBounds(), { maxZoom: 1 });
      });
    },
  });
  document.getElementById("controls").prepend(searchBox);
});

loadFloor(currentFloor);
