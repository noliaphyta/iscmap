// Standalone annotation tool for the Swem Library map (tools/annotate-
// library.html). Counterpart to src/annotateMain.js (ISC) - deliberately a
// separate copy for the same reason src/libraryMain.js is (see that
// file's top-of-file note): different data module, no background image,
// and its own localStorage key/export filename so the two buildings'
// draft and published annotations can never collide or overwrite each
// other. Everything here is additive: it reads data/library.geojson and
// reuses pixelCRS/floorControl/mapConfig exactly as the ISC tool does,
// but never imports or touches roomLayer.js, libraryMain.js, or that
// page's own interactive room polygons. Room colors and notes are stored
// separately in localStorage (library-map-annotations-v1), exportable/
// importable as their own JSON file - data/library.geojson itself is
// never written to.
import { pixelToLatLng, latLngToPixel, polygonToLatLngs, boundsForFeatures } from "./pixelCRS.js";
import { loadGeoData } from "./libraryGeoData.js";
import { createControlPanel } from "./floorControl.js";
import { CATEGORY_STYLE, styleForCategory, categoryKey } from "./mapConfig.js";
import { NOTE_ICONS as ICONS } from "./icons.js";
import { buildNoteMarker } from "./notesLayer.js";

const STORAGE_KEY = "library-map-annotations-v1";

// --- persistence -----------------------------------------------------
function loadAnnotations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, rooms: {}, notes: [] };
    const parsed = JSON.parse(raw);
    return { version: 1, rooms: parsed.rooms || {}, notes: parsed.notes || [] };
  } catch (e) {
    return { version: 1, rooms: {}, notes: [] };
  }
}

let annotations = loadAnnotations();

function saveAnnotations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
  } catch (e) {
    setStatus("Couldn't save - your browser's local storage may be full or disabled.");
  }
}

// --- small string helpers ---------------------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Lightweight duplicate of roomLayer.js's area-weighted centroid (that
// function isn't exported, and this tool intentionally never imports
// roomLayer.js at all - see the top-of-file note) - only used here to
// place the small reference room-number labels on the base layer.
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
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return [sx / ring.length, sy / ring.length];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// Standard ray-casting point-in-polygon test, in the same pixel space as
// the geojson coordinates. Used instead of Leaflet click events on the
// room shapes themselves, because the base layer is deliberately
// non-interactive (see renderBaseRooms) - every click reaches the map
// once, uniformly, whether it lands on a room or open background.
function pointInRing(px, py, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function roomAtPixel(px, py) {
  for (const feature of currentFeatures) {
    if (pointInRing(px, py, feature.geometry.coordinates[0])) return feature;
  }
  return null;
}

// --- map setup ---------------------------------------------------------
const map = L.map("map", {
  crs: L.CRS.Simple,
  minZoom: -4,
  maxZoom: 3,
  zoomSnap: 0.25,
  attributionControl: false,
  // Default zoom control sits top-left, same corner main.css pushes it to
  // below the header - but that's exactly where #tools-left lives on this
  // page (see annotate.css). Scroll/pinch/double-click zoom all still
  // work without it.
  zoomControl: false,
});

// No addBackgroundImage() here (contrast with src/annotateMain.js) -
// there's no library landscape image, and ISC's site-landscape.png
// alignment constants don't mean anything against this building's
// geometry. See src/libraryMain.js's equivalent note.

const baseLayerGroup = L.layerGroup().addTo(map);
const paintLayerGroup = L.layerGroup().addTo(map);
const noteLayerGroup = L.layerGroup().addTo(map);

let geo = null;
let currentLevel = null;
let currentFeatures = []; // this level's features with geometry, for hit-testing + recoloring

// --- base rooms (read-only reference layer) -----------------------------
function renderBaseRooms(features) {
  baseLayerGroup.clearLayers();
  currentFeatures = features.filter((f) => f.geometry);

  for (const feature of currentFeatures) {
    const ring = feature.geometry.coordinates[0];
    const style = styleForCategory(feature.properties.Category);

    // interactive:false is deliberate - see pointInRing/roomAtPixel above.
    L.polygon(polygonToLatLngs(ring), {
      color: "#000000",
      weight: 1,
      fillColor: style.fill,
      fillOpacity: 0.35,
      interactive: false,
    }).addTo(baseLayerGroup);

    const [cx, cy] = centroid(ring);
    L.marker(pixelToLatLng(cx, cy), {
      icon: L.divIcon({
        className: "base-room-label",
        html: `<span>${escapeHtml(feature.properties.room_number || "")}</span>`,
        iconSize: [0, 0],
      }),
      interactive: false,
      keyboard: false,
    }).addTo(baseLayerGroup);
  }

  renderPaintedRooms();
}

// --- painted rooms (color overrides, drawn ON TOP of the base polygon -
// the base polygon itself is never modified or removed) ------------------
function renderPaintedRooms() {
  paintLayerGroup.clearLayers();
  for (const feature of currentFeatures) {
    const color = annotations.rooms[feature.properties.space_id];
    if (!color) continue;
    L.polygon(polygonToLatLngs(feature.geometry.coordinates[0]), {
      className: "painted-room",
      stroke: false,
      fillColor: color,
      fillOpacity: 0.65,
      interactive: false,
    }).addTo(paintLayerGroup);
  }
}

// --- notes ---------------------------------------------------------------
function renderNotes() {
  noteLayerGroup.clearLayers();
  for (const note of annotations.notes) {
    if (note.level !== currentLevel) continue;

    // note.icon/note.color come from annotations state, which can be
    // populated by importAnnotations() from an arbitrary JSON file someone
    // else handed you (see "Import JSON" in the data panel) - not just
    // from this page's own color-picker/icon-grid UI. buildNoteMarker
    // (src/notesLayer.js) escapes both before interpolating them into the
    // marker's innerHTML, guarding against a crafted value (e.g. an icon
    // of `x.svg" onerror="...`) breaking out of the src=/style= attribute
    // it's placed into, regardless of where the value came from.
    const marker = buildNoteMarker(note, {
      editable: true,
      onDragEnd: (n, e) => {
        const { x, y } = latLngToPixel(e.target.getLatLng());
        n.x = x;
        n.y = y;
        saveAnnotations();
      },
      onClick: (n, e) => {
        L.DomEvent.stopPropagation(e);
        if (currentMode === "erase") {
          if (confirm(`Delete this note?${n.text ? ` "${n.text}"` : ""}`)) {
            annotations.notes = annotations.notes.filter((existing) => existing.id !== n.id);
            saveAnnotations();
            renderNotes();
          }
        } else {
          openNoteEditor(n);
        }
      },
    });

    marker.addTo(noteLayerGroup);
  }
}

// --- popover (paint-color form or note form) ------------------------------
const popoverEl = document.getElementById("popover");

function positionPopover(containerPoint) {
  const mapRect = document.getElementById("map").getBoundingClientRect();
  let left = mapRect.left + containerPoint.x + 14;
  let top = mapRect.top + containerPoint.y - 10;
  left = Math.max(8, Math.min(left, window.innerWidth - 256));
  top = Math.max(8, Math.min(top, window.innerHeight - 300));
  popoverEl.style.left = `${left}px`;
  popoverEl.style.top = `${top}px`;
}

function closePopover() {
  popoverEl.hidden = true;
  popoverEl.innerHTML = "";
}

function openPaintPopover(feature, latlng) {
  const spaceId = feature.properties.space_id;
  const current = annotations.rooms[spaceId] || styleForCategory(feature.properties.Category).fill;

  popoverEl.innerHTML = `
    <h3>${escapeHtml(feature.properties.room_number || "Room")}</h3>
    <label for="paint-color">Color</label>
    <input type="color" id="paint-color" value="${escapeAttr(current)}" />
    <div class="popover-actions">
      <button type="button" class="tool-btn secondary" id="paint-clear">Clear</button>
      <button type="button" class="tool-btn" id="paint-apply">Apply</button>
    </div>
  `;
  popoverEl.hidden = false;
  positionPopover(map.latLngToContainerPoint(latlng));

  document.getElementById("paint-apply").onclick = () => {
    annotations.rooms[spaceId] = document.getElementById("paint-color").value;
    saveAnnotations();
    renderPaintedRooms();
    closePopover();
  };
  document.getElementById("paint-clear").onclick = () => {
    delete annotations.rooms[spaceId];
    saveAnnotations();
    renderPaintedRooms();
    closePopover();
  };
}

function iconGridHtml(selected) {
  const noneBtn = `<button type="button" class="none-option${selected ? "" : " selected"}" data-icon="">None</button>`;
  const iconBtns = ICONS.map(
    (file) => `
      <button type="button" class="${selected === file ? "selected" : ""}" data-icon="${file}">
        <img src="icons/${file}" alt="${escapeAttr(file)}" />
      </button>`
  ).join("");
  return `<div class="icon-grid">${noneBtn}${iconBtns}</div>`;
}

function showNotePopover(note, latlng, isNew) {
  let selectedIcon = note.icon || "";

  popoverEl.innerHTML = `
    <h3>${isNew ? "Add note" : "Edit note"}</h3>
    <label for="note-text">Text</label>
    <input type="text" id="note-text" maxlength="60" value="${escapeAttr(note.text || "")}" placeholder="e.g. Greenhouse" />
    <label>Icon</label>
    ${iconGridHtml(selectedIcon)}
    <label for="note-color">Color</label>
    <input type="color" id="note-color" value="${escapeAttr(note.color || "#000000")}" />
    <div class="popover-actions">
      ${isNew ? "" : `<button type="button" class="tool-btn danger" id="note-delete">Delete</button>`}
      <button type="button" class="tool-btn secondary" id="note-cancel">Cancel</button>
      <button type="button" class="tool-btn" id="note-save">${isNew ? "Add" : "Save"}</button>
    </div>
  `;
  popoverEl.hidden = false;
  positionPopover(map.latLngToContainerPoint(latlng));

  popoverEl.querySelectorAll(".icon-grid button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedIcon = btn.dataset.icon;
      popoverEl.querySelectorAll(".icon-grid button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });

  document.getElementById("note-cancel").onclick = closePopover;

  if (!isNew) {
    document.getElementById("note-delete").onclick = () => {
      annotations.notes = annotations.notes.filter((n) => n.id !== note.id);
      saveAnnotations();
      renderNotes();
      closePopover();
    };
  }

  document.getElementById("note-save").onclick = () => {
    const text = document.getElementById("note-text").value.trim();
    const color = document.getElementById("note-color").value;
    if (!text && !selectedIcon) {
      setStatus("Add some text or pick an icon before saving.");
      return;
    }
    if (isNew) {
      annotations.notes.push({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        level: currentLevel,
        x: note.x,
        y: note.y,
        text,
        color,
        icon: selectedIcon || null,
      });
    } else {
      note.text = text;
      note.color = color;
      note.icon = selectedIcon || null;
    }
    saveAnnotations();
    renderNotes();
    closePopover();
  };
}

function openNoteCreator(x, y, latlng) {
  showNotePopover({ x, y, text: "", color: "#000000", icon: null }, latlng, true);
}

function openNoteEditor(note) {
  showNotePopover(note, pixelToLatLng(note.x, note.y), false);
}

// --- modes -----------------------------------------------------------
const MODES = [
  { id: "pan", label: "Pan / Zoom", key: "1" },
  { id: "paint", label: "Paint Room", key: "2" },
  { id: "note", label: "Add Note", key: "3" },
  { id: "erase", label: "Erase", key: "4" },
];

const STATUS_FOR_MODE = {
  pan: "Pan and zoom the map. Switch mode below to start annotating.",
  paint: "Click a room to give it a custom color.",
  note: "Click anywhere on the map to add a text/icon note.",
  erase: "Click a colored room to clear it, or a note to delete it.",
};

let currentMode = "pan";

function setStatus(msg) {
  document.getElementById("status-bar").textContent = msg;
}

function renderModeToolbar() {
  const el = document.getElementById("mode-toolbar");
  el.innerHTML =
    `<h2>Mode</h2>` +
    MODES.map(
      (m) => `
        <button type="button" class="mode-btn${m.id === currentMode ? " active" : ""}" data-mode="${m.id}">
          ${m.label}<span class="mode-key">${m.key}</span>
        </button>`
    ).join("");
  el.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
}

function setMode(mode) {
  currentMode = mode;
  closePopover();
  renderModeToolbar();
  const mapEl = document.getElementById("map");
  mapEl.classList.toggle("mode-paint", mode === "paint");
  mapEl.classList.toggle("mode-note", mode === "note");
  mapEl.classList.toggle("mode-erase", mode === "erase");
  setStatus(STATUS_FOR_MODE[mode]);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePopover();
    return;
  }
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return; // don't hijack typing
  const m = MODES.find((mm) => mm.key === e.key);
  if (m) setMode(m.id);
});

// --- map click routing -------------------------------------------------
function handleMapClick(latlng) {
  closePopover();
  const { x, y } = latLngToPixel(latlng);

  if (currentMode === "paint") {
    const feature = roomAtPixel(x, y);
    if (!feature) {
      setStatus("No room there - click inside a room's outline to color it.");
      return;
    }
    openPaintPopover(feature, latlng);
  } else if (currentMode === "note") {
    openNoteCreator(x, y, latlng);
  } else if (currentMode === "erase") {
    const feature = roomAtPixel(x, y);
    if (feature && annotations.rooms[feature.properties.space_id]) {
      delete annotations.rooms[feature.properties.space_id];
      saveAnnotations();
      renderPaintedRooms();
      setStatus(`Cleared color from ${feature.properties.room_number || "that room"}.`);
    } else {
      setStatus("No painted room there. Tap a note to delete it, or a colored room.");
    }
  }
}

map.on("click", (e) => handleMapClick(e.latlng));
map.on("movestart zoomstart", closePopover);

// --- recolor-by-category panel (bulk tool, e.g. "make hallways a
// different color" without clicking every hallway individually) --------
function renderRecolorPanel() {
  const el = document.getElementById("recolor-panel");
  const options = Object.entries(CATEGORY_STYLE)
    .map(([key, { label }]) => `<option value="${key}">${escapeHtml(label)}</option>`)
    .join("");

  el.innerHTML = `
    <h2>Recolor a category</h2>
    <select id="recolor-category">${options}</select>
    <input type="color" id="recolor-color" value="#ffd100" />
    <label class="tool-checkbox">
      <input type="checkbox" id="recolor-all-floors" /> Apply to all floors
    </label>
    <button type="button" class="tool-btn" id="recolor-apply">Apply to matching rooms</button>
  `;

  document.getElementById("recolor-apply").onclick = () => {
    const key = document.getElementById("recolor-category").value;
    const color = document.getElementById("recolor-color").value;
    const allFloors = document.getElementById("recolor-all-floors").checked;
    const pool = allFloors ? geo.features : currentFeatures;

    let count = 0;
    for (const feature of pool) {
      if (!feature.geometry) continue;
      if (categoryKey(feature.properties.Category) === key) {
        annotations.rooms[feature.properties.space_id] = color;
        count++;
      }
    }
    saveAnnotations();
    renderPaintedRooms();
    setStatus(`Colored ${count} room${count === 1 ? "" : "s"}${allFloors ? " across all floors" : ""}.`);
  };
}

// --- data panel (export / import / clear) -------------------------------
function exportAnnotations() {
  const blob = new Blob([JSON.stringify(annotations, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Named to match data/library-annotations.json (see src/libraryConfig.js's
  // ANNOTATIONS_PATH) so "download, then drop into the repo" needs no
  // renaming - same convention as the ISC tool's own "annotations.json".
  a.download = "library-annotations.json";
  a.click();
  URL.revokeObjectURL(url);
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Imported JSON is arbitrary user-supplied data (see importAnnotations
// below) - this coerces it down to the exact shape the rest of the app
// assumes (rooms: string -> "#rrggbb"; notes: array of well-typed
// objects with icon restricted to this tool's own icon set), dropping
// anything that doesn't fit rather than trusting the file's structure.
// escapeAttr at the render call sites (see renderNotes/openPaintPopover/
// showNotePopover) is what actually prevents attribute-breakout HTML
// injection from a crafted value; this is a second, independent layer
// that keeps malformed values (wrong types, bogus colors, made-up icon
// filenames) from ever reaching state or rendering in the first place.
function sanitizeImportedAnnotations(parsed) {
  const rooms = {};
  if (parsed.rooms && typeof parsed.rooms === "object") {
    for (const [spaceId, color] of Object.entries(parsed.rooms)) {
      if (typeof color === "string" && HEX_COLOR_RE.test(color)) {
        rooms[spaceId] = color;
      }
    }
  }

  const notes = [];
  if (Array.isArray(parsed.notes)) {
    for (const n of parsed.notes) {
      if (!n || typeof n !== "object") continue;
      if (typeof n.x !== "number" || typeof n.y !== "number") continue;
      notes.push({
        id: typeof n.id === "string" && n.id ? n.id : `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        level: typeof n.level === "string" ? n.level : null,
        x: n.x,
        y: n.y,
        text: typeof n.text === "string" ? n.text.slice(0, 60) : "",
        color: typeof n.color === "string" && HEX_COLOR_RE.test(n.color) ? n.color : "#000000",
        icon: typeof n.icon === "string" && ICONS.includes(n.icon) ? n.icon : null,
      });
    }
  }

  return { version: 1, rooms, notes };
}

function importAnnotations(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      annotations = sanitizeImportedAnnotations(parsed);
      saveAnnotations();
      renderPaintedRooms();
      renderNotes();
      setStatus("Import complete.");
    } catch (err) {
      alert("That file doesn't look like a valid annotations export.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

function renderDataPanel() {
  const el = document.getElementById("data-panel");
  el.innerHTML = `
    <h2>Your annotations</h2>
    <button type="button" class="tool-btn secondary" id="export-btn">Export JSON</button>
    <button type="button" class="tool-btn secondary" id="import-btn">Import JSON</button>
    <input type="file" id="import-file" accept="application/json" />
    <button type="button" class="tool-btn danger" id="clear-btn">Clear all</button>
    <p class="data-note">Saved automatically in this browser only - export a backup before clearing browser data or switching devices. To publish for every visitor of the live site: Export, then commit the downloaded <code>library-annotations.json</code> as <code>data/library-annotations.json</code> in the repo and push - GitHub Pages serves it from there automatically. This never touches data/library.geojson.</p>
  `;
  document.getElementById("export-btn").onclick = exportAnnotations;
  document.getElementById("import-btn").onclick = () => document.getElementById("import-file").click();
  document.getElementById("import-file").addEventListener("change", importAnnotations);
  document.getElementById("clear-btn").onclick = () => {
    if (confirm("Delete every color and note you've added? This can't be undone (export a backup first if unsure).")) {
      annotations = { version: 1, rooms: {}, notes: [] };
      saveAnnotations();
      renderPaintedRooms();
      renderNotes();
    }
  };
}

// --- init ----------------------------------------------------------------
async function init() {
  try {
    geo = await loadGeoData();
  } catch (err) {
    console.error("Couldn't load room data", err);
    setStatus("Couldn't load the library map data. Check your connection and try again.");
    return;
  }

  let hasFit = false;
  function loadLevel(level) {
    currentLevel = level;
    const features = geo.featuresForLevel(level);
    const bounds = boundsForFeatures(features);
    if (bounds) {
      // Swem's floor plans are noticeably wider (landscape) than ISC's -
      // a strict "zoom exactly matching the bbox" minimum left no room to
      // breathe, filling the screen edge-to-edge with #tools-left/
      // #data-panel chrome sitting directly on top of the floor plan
      // instead of over blank margin. Knock the floor down half a zoom
      // step (zoomSnap is 0.25, so -0.5 is two of Leaflet's own snap
      // increments) so there's always a little headroom to zoom out
      // beyond the initial fit.
      map.setMinZoom(map.getBoundsZoom(bounds, false) - 0.5);
      // Same "only fit once" as tools/annotate.html (ISC) - safe now that
      // data/library.geojson's floors are aligned into one shared
      // coordinate space by tools/align_floors.py (elevator/stairway
      // shafts as anchors). Before that alignment existed, this had to
      // re-fit on every switch, or the new floor's rooms rendered
      // entirely outside the previous floor's viewport.
      if (!hasFit) {
        map.fitBounds(bounds, { padding: [24, 24] });
        hasFit = true;
      }
    }
    renderBaseRooms(features);
    renderNotes();
    panel.render(level);
  }

  const panel = createControlPanel({ levels: geo.allLevels, onSelectLevel: loadLevel });
  document.getElementById("controls").appendChild(panel.root);

  renderModeToolbar();
  renderRecolorPanel();
  renderDataPanel();
  setStatus(STATUS_FOR_MODE.pan);

  const startLevel = geo.allLevels.includes("1") ? "1" : geo.allLevels[0];
  loadLevel(startLevel);
}

init();
