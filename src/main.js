import { boundsForFeatures } from "./pixelCRS.js";
import { renderRooms, clearSelection } from "./roomLayer.js";
import { createControlPanel } from "./floorControl.js";
import { createLegend } from "./legend.js";
import { createSearchBox } from "./search.js";
import { loadGeoData } from "./geoData.js";
import { createThemeToggle } from "./theme.js";
import { addBackgroundImage } from "./backgroundOverlay.js";

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -4, // conservative fallback until the first level's bounds set the real limit below
  maxZoom: 3,
  zoomSnap: 0.25,
  attributionControl: false,
  // Canvas instead of the default SVG renderer: with ~300 room polygons on
  // screen per floor, SVG means Leaflet rewrites 300 individual <path>
  // `d` attributes on every zoom frame. Canvas draws them all into one
  // element per frame instead, which is what actually removes the
  // stutter (this matters far more than any per-polygon style tweak).
  renderer: L.canvas({ padding: 0.5 }),
});

const background = addBackgroundImage(map);

const currentRoomLayerGroup = L.layerGroup().addTo(map);
let hasFit = false; // only auto-fit on the very first level load - once someone
                     // is panned/zoomed in, switching floors shouldn't reset them
let currentBounds = null; // bounds of the level currently on screen, for the reset-view button
let currentPolyById = new Map(); // space_id -> L.polygon for the level on screen, for search selection
let currentFeatures = null; // features for the level on screen, so theme toggle can re-render without a full loadLevel (see rerenderCurrentLevel)

// Every floor plan used to share one fixed pixel canvas, so minZoom was the
// same everywhere. Now that bounds come from each level's own data bbox,
// they genuinely differ floor to floor - recomputed on every level switch
// (see loadLevel) and on resize.
function updateMinZoom(bounds) {
  if (!bounds) return;
  map.setMinZoom(map.getBoundsZoom(bounds, false));
}
window.addEventListener("resize", () => updateMinZoom(currentBounds));

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

// --- info panel ---
// Room click / search select shows only room number, Category (+
// SubCategory if present), and Description - Area/Occupancy/Vacancy
// fields exist in the data but are deliberately dropped as noise for this
// app's purpose.
const infoPanel = document.getElementById("info-panel");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateInfoPanel(props, { unmapped = false } = {}) {
  if (!props) {
    infoPanel.innerHTML = `<p class="info-empty">Search for a room, or click a room on the map to see details here.</p>`;
    return;
  }
  const category = props.Category || "Uncategorized";
  const subcategory = props.SubCategory ? ` / ${props.SubCategory}` : "";
  const description = props.Description
    ? `<p class="info-detail">${escapeHtml(props.Description)}</p>`
    : "";
  const unmappedNote = unmapped
    ? `<p class="info-detail info-dim">No shape data for this room, so it can't be shown on the map.</p>`
    : "";
  infoPanel.innerHTML = `
    <h3>${escapeHtml(props.room_number || "(no code)")}</h3>
    <p class="info-category">${escapeHtml(category)}${escapeHtml(subcategory)}</p>
    ${description}
    ${unmappedNote}
  `;
}
updateInfoPanel(null);

async function init() {
  let geo;
  try {
    geo = await loadGeoData();
  } catch (err) {
    console.error("Couldn't load room data", err);
    showError("Couldn't load the campus map data. Check your connection and try again.");
    return;
  }

  // roomLayer.js's renderRooms captures the polygon stroke color once per
  // call (read from the live --ink custom property), so a theme toggle
  // needs *something* to re-run renderRooms against the level currently on
  // screen - otherwise the outlines silently keep whatever color was
  // current at the last floor switch until the next one happens to occur.
  // This intentionally re-renders in place (no re-fit, no bounds/minZoom
  // recompute) and drops the current selection highlight, which is an
  // acceptable, barely-noticeable reset for what's just a chrome toggle.
  function rerenderCurrentLevel() {
    if (!currentFeatures) return;
    currentRoomLayerGroup.clearLayers();
    clearSelection();
    currentPolyById = renderRooms(map, currentRoomLayerGroup, currentFeatures, {
      onRoomClick: (props) => updateInfoPanel(props),
    });
  }

  function loadLevel(level) {
    const features = geo.featuresForLevel(level);
    currentFeatures = features;
    currentBounds = boundsForFeatures(features);
    updateMinZoom(currentBounds);

    // renderRooms measures label/icon scale via map.latLngToContainerPoint(),
    // which throws until the map has a center/zoom set at least once
    // ("Set map center and zoom first."). On the very first load the map
    // hasn't been given a view yet, so it has to happen before renderRooms
    // runs, not after. On every subsequent floor switch the map already has
    // a view (and per spec shouldn't be re-fit), so this is a no-op there.
    if (!hasFit && currentBounds) {
      map.fitBounds(currentBounds);
      hasFit = true;
    }

    currentRoomLayerGroup.clearLayers();
    clearSelection(); // old floor's selected polygon no longer exists once cleared above
    currentPolyById = renderRooms(map, currentRoomLayerGroup, features, {
      onRoomClick: (props) => updateInfoPanel(props),
    });

    panel.render(level);
    updateInfoPanel(null);
  }

  // --- floor control: one shared stack drives both buildings at once ---
  const panel = createControlPanel({ levels: geo.allLevels, onSelectLevel: loadLevel });
  document.getElementById("controls").appendChild(panel.root);

  // --- theme toggle ---
  const themeToggle = createThemeToggle({ onThemeChange: rerenderCurrentLevel });
  document.getElementById("controls").appendChild(themeToggle.root);

  // --- landscape background toggle ---
  const landscapeToggle = document.createElement("button");
  landscapeToggle.className = "landscape-toggle-btn";
  landscapeToggle.type = "button";
  function renderLandscapeToggle() {
    const visible = background.isVisible();
    landscapeToggle.textContent = visible ? "HIDE LANDSCAPE" : "SHOW LANDSCAPE";
    landscapeToggle.setAttribute("aria-label", visible ? "Hide site landscape image" : "Show site landscape image");
    landscapeToggle.setAttribute("aria-pressed", String(visible));
  }
  landscapeToggle.addEventListener("click", () => {
    background.setVisible(!background.isVisible());
    renderLandscapeToggle();
  });
  renderLandscapeToggle();
  document.getElementById("controls").appendChild(landscapeToggle);

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

  // --- legend ---
  const legend = createLegend();
  document.getElementById("app").appendChild(legend.root);

  // --- search: built from the geojson's own search index (every feature
  // with a non-empty room_number, geometry or not), not a separately
  // OCR'd label set, so search accuracy always matches what's on the map.
  const searchBox = createSearchBox({
    index: geo.searchIndex,
    levelOf: geo.levelOf,
    canonicalLevel: geo.canonicalLevel,
    onSelect: (feature) => {
      const level = geo.canonicalLevel(geo.levelOf(feature.properties.floor_label));
      loadLevel(level);

      if (feature.geometry) {
        const polygon = currentPolyById.get(feature.properties.space_id);
        if (polygon) {
          polygon.fire("click"); // reuses the normal click-select styling/info-panel path
          map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: map.getMaxZoom() - 0.25 });
        }
      } else {
        // No geometry to zoom to (see geoData.js) - still a legitimate
        // result, just can't be shown on the map. Surface it via the info
        // panel instead of crashing or silently dropping it.
        updateInfoPanel(feature.properties, { unmapped: true });
      }
    },
  });
  document.getElementById("controls").prepend(searchBox);

  const startLevel = geo.allLevels.includes("1") ? "1" : geo.allLevels[0];
  loadLevel(startLevel);
}

init();
