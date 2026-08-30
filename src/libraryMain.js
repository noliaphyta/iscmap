// Library counterpart to src/main.js. Deliberately a separate copy rather
// than parameterizing main.js itself: the two differ in more than just
// data paths (single building vs. two, no landscape background image -
// see below), and main.js is already dense enough that threading an
// if(building === ...) branch through it would cost more clarity than
// this small amount of duplication does. If a third building shows up,
// the shared parts (info panel, theme toggle, search wiring, reset-view)
// are the first candidates to extract into a common module.
import { boundsForFeatures } from "./pixelCRS.js";
import { renderRooms, clearSelection } from "./roomLayer.js";
import { createControlPanel } from "./floorControl.js";
import { createLegend } from "./legend.js";
import { createSearchBox } from "./search.js";
import { loadGeoData } from "./libraryGeoData.js";
import { createThemeToggle } from "./theme.js";
import { loadPublishedAnnotations } from "./annotations.js";
import { buildNoteMarker } from "./notesLayer.js";
import { ANNOTATIONS_PATH } from "./libraryConfig.js";

const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -4, // conservative fallback until the first level's bounds set the real limit below
  maxZoom: 3,
  zoomSnap: 0.25,
  attributionControl: false,
  renderer: L.canvas({ padding: 0.5 }), // see main.js - same canvas-vs-SVG rationale applies here
});

// No addBackgroundImage() here (contrast with main.js): that overlay's
// ANCHOR_X/ANCHOR_Y/SCALE constants (src/backgroundOverlay.js) are
// calibrated tie-points between ISC's own site-landscape.png and ISC's
// rooms.geojson pixel space specifically - they don't mean anything
// against the library's unrelated geometry, and there's no library
// landscape image to show anyway. If one gets produced later, give
// backgroundOverlay.js its own image path + anchor/scale params rather
// than reusing ISC's numbers here.

const currentRoomLayerGroup = L.layerGroup().addTo(map);
const currentNoteLayerGroup = L.layerGroup().addTo(map);
let hasFit = false;
let currentBounds = null;
let currentPolyById = new Map();
let currentFeatures = null;

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
const infoPanel = document.getElementById("info-panel");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateInfoPanel(props, { unmapped = false } = {}) {
  infoPanel.hidden = false;
  if (!props) {
    infoPanel.classList.remove("has-room");
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
  infoPanel.classList.add("has-room");
  infoPanel.innerHTML = `
    <h3>${escapeHtml(props.room_number || "(no code)")}</h3>
    <p class="info-category">${escapeHtml(category)}${escapeHtml(subcategory)}</p>
    ${description}
    ${unmappedNote}
    <p class="info-hint">Tap to hide</p>
  `;
}
updateInfoPanel(null);

infoPanel.addEventListener("click", () => {
  if (!infoPanel.classList.contains("has-room")) return;
  clearSelection();
  infoPanel.classList.remove("has-room");
  infoPanel.hidden = true;
});

async function init() {
  let geo;
  let published;
  try {
    [geo, published] = await Promise.all([
      loadGeoData(),
      loadPublishedAnnotations(ANNOTATIONS_PATH),
    ]);
  } catch (err) {
    console.error("Couldn't load room data", err);
    showError("Couldn't load the library map data. Check your connection and try again.");
    return;
  }

  const colorOverrides = new Map(Object.entries(published.rooms));

  function renderPublishedNotes(level) {
    currentNoteLayerGroup.clearLayers();
    for (const note of published.notes) {
      if (note.level !== level) continue;
      buildNoteMarker(note).addTo(currentNoteLayerGroup);
    }
  }

  function rerenderCurrentLevel() {
    if (!currentFeatures) return;
    currentRoomLayerGroup.clearLayers();
    clearSelection();
    currentPolyById = renderRooms(map, currentRoomLayerGroup, currentFeatures, {
      onRoomClick: (props) => updateInfoPanel(props),
      colorOverrides,
    });
  }

  function loadLevel(level) {
    const features = geo.featuresForLevel(level);
    currentFeatures = features;
    currentBounds = boundsForFeatures(features);
    updateMinZoom(currentBounds);

    if (!hasFit && currentBounds) {
      map.fitBounds(currentBounds);
      hasFit = true;
    }

    currentRoomLayerGroup.clearLayers();
    clearSelection();
    currentPolyById = renderRooms(map, currentRoomLayerGroup, features, {
      onRoomClick: (props) => updateInfoPanel(props),
      colorOverrides,
    });
    renderPublishedNotes(level);

    panel.render(level);
    updateInfoPanel(null);
  }

  // --- floor control ---
  const panel = createControlPanel({ levels: geo.allLevels, onSelectLevel: loadLevel });
  document.getElementById("controls").appendChild(panel.root);

  // --- theme toggle ---
  const themeToggle = createThemeToggle({ onThemeChange: rerenderCurrentLevel });
  document.getElementById("controls").appendChild(themeToggle.root);

  // No landscape toggle button here - contrast with main.js's
  // #landscape-toggle-btn, which controls ISC's site-landscape.png
  // background image. There's no equivalent library background overlay
  // (see the addBackgroundImage note above), so the button would have
  // nothing to toggle.

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

  // --- search ---
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
          polygon.fire("click");
          map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: map.getMaxZoom() - 0.25 });
        }
      } else {
        updateInfoPanel(feature.properties, { unmapped: true });
      }
    },
  });
  document.getElementById("controls").prepend(searchBox);

  const startLevel = geo.allLevels.includes("1") ? "1" : geo.allLevels[0];
  loadLevel(startLevel);
}

init();
