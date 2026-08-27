// Loads the *published* annotations overlay (data/annotations.json,
// committed to the repo and deployed via GitHub Pages like everything
// else - see tools/annotate.html's data panel for the publish steps) for
// read-only rendering in the main app. This is deliberately independent
// of tools/annotate.html's own loadAnnotations(), which reads the
// authoring tool's live per-browser localStorage draft instead - the two
// are different data sources for different audiences (one author editing
// locally vs. every visitor of the deployed site) that happen to share a
// JSON shape.
import { ANNOTATIONS_PATH } from "./mapConfig.js";
import { NOTE_ICONS } from "./icons.js";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Same shape/validity rules as annotateMain.js's sanitizeImportedAnnotations
// (rooms: space_id -> "#rrggbb"; notes: well-typed objects, icon
// restricted to NOTE_ICONS) applied here for the same reason: this file
// is committed to source control and reviewable, but it's still data
// fetched over the network and parsed as JSON, so it gets the same
// "don't trust the structure, coerce it down to what's expected, drop
// anything that doesn't fit" treatment before anything renders it.
function sanitize(parsed) {
  const rooms = {};
  if (parsed && parsed.rooms && typeof parsed.rooms === "object") {
    for (const [spaceId, color] of Object.entries(parsed.rooms)) {
      if (typeof color === "string" && HEX_COLOR_RE.test(color)) {
        rooms[spaceId] = color;
      }
    }
  }

  const notes = [];
  if (parsed && Array.isArray(parsed.notes)) {
    for (const n of parsed.notes) {
      if (!n || typeof n !== "object") continue;
      if (typeof n.x !== "number" || typeof n.y !== "number") continue;
      notes.push({
        id: typeof n.id === "string" && n.id ? n.id : `n_${Math.random().toString(36).slice(2, 9)}`,
        level: typeof n.level === "string" ? n.level : null,
        x: n.x,
        y: n.y,
        text: typeof n.text === "string" ? n.text.slice(0, 60) : "",
        color: typeof n.color === "string" && HEX_COLOR_RE.test(n.color) ? n.color : "#000000",
        icon: typeof n.icon === "string" && NOTE_ICONS.includes(n.icon) ? n.icon : null,
      });
    }
  }

  return { rooms, notes };
}

// cache: "no-store" - GitHub Pages and browsers both cache static assets
// aggressively, and the whole point of this file is "publish an update,
// everyone sees it" - a stale cached copy would quietly defeat that. The
// file is small (room colors + notes only, not room geometry), so this
// isn't a meaningful bandwidth concern.
export async function loadPublishedAnnotations() {
  try {
    const res = await fetch(ANNOTATIONS_PATH, { cache: "no-store" });
    if (!res.ok) return { rooms: {}, notes: [] };
    const parsed = await res.json();
    return sanitize(parsed);
  } catch (e) {
    console.warn("Couldn't load published annotations:", e);
    return { rooms: {}, notes: [] };
  }
}
