// Builds the Leaflet marker for one on-map note. Factored out of
// src/annotateMain.js so the main app's read-only rendering of the
// *published* overlay (see src/annotations.js, wired into src/main.js)
// builds the exact same marker markup/CSS-class contract that
// styles/main.css's .map-note rules expect, instead of a second
// hand-maintained copy that could quietly drift from the authoring
// tool's version.
import { pixelToLatLng } from "./pixelCRS.js";

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

// `editable` toggles dragging + the two interaction callbacks:
//   - onDragEnd(note, event) - only wired when editable is true.
//   - onClick(note, event)   - wired whenever provided, editable or not.
// The main app's read-only render passes neither, so `interactive`
// defaults to false and these markers don't intercept clicks that should
// reach the room polygon or basemap underneath them.
export function buildNoteMarker(note, { editable = false, onDragEnd, onClick } = {}) {
  const iconHtml = note.icon
    ? `<img src="icons/${escapeAttr(note.icon)}" alt="" draggable="false" />`
    : "";
  const textHtml = note.text ? `<span>${escapeHtml(note.text)}</span>` : "";
  const iconOnly = note.icon && !note.text;
  const classes = ["map-note", iconOnly ? "icon-only" : "", editable ? "" : "published"]
    .filter(Boolean)
    .join(" ");

  const marker = L.marker(pixelToLatLng(note.x, note.y), {
    icon: L.divIcon({
      className: "map-note-marker",
      html: `<div class="${classes}" style="border-color:${escapeAttr(note.color || "#000000")}">${iconHtml}${textHtml}</div>`,
      iconSize: [0, 0],
    }),
    draggable: editable,
    keyboard: false,
    interactive: editable || !!onClick,
  });

  if (editable && onDragEnd) marker.on("dragend", (e) => onDragEnd(note, e));
  if (onClick) marker.on("click", (e) => onClick(note, e));

  return marker;
}
