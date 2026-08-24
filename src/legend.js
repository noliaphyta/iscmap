import { FEATURE_TYPES, EXIT_ARROW_ICON } from "./icons.js";

// Types listed in the on-map icon key. Point features that are placed
// rarely/contextually (info desks, restaurants, lost & found, fire
// extinguishers) are still rendered on the map and clickable, but are left
// out of the key itself to keep it short - it only surfaces the icons
// someone is likely to actually be scanning for.
const KEY_FEATURE_TYPES = ["exit", "elevator", "stairs", "restroom", "cafe", "study"];

// Creates the DOM for the legend/key panel: an icon + label per
// point-feature type, sourced from FEATURE_TYPES - so it can't drift out
// of sync with what's actually placed on the map.
// Collapsible via a toggle button, docked bottom-right (info panel owns
// bottom-left).
export function createLegend() {
  const root = document.createElement("div");
  root.className = "legend-panel";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "legend-toggle-btn";
  toggleBtn.type = "button";
  toggleBtn.textContent = "KEY";
  toggleBtn.setAttribute("aria-expanded", "true");
  toggleBtn.setAttribute("aria-label", "Toggle map key");
  root.appendChild(toggleBtn);

  const list = document.createElement("div");
  list.className = "legend-list";
  root.appendChild(list);

  const iconHeading = document.createElement("div");
  iconHeading.className = "legend-heading";
  iconHeading.textContent = "Map Icons";
  list.appendChild(iconHeading);

  for (const type of KEY_FEATURE_TYPES) {
    const { label, icon } = FEATURE_TYPES[type];
    const row = document.createElement("div");
    row.className = "legend-row";

    const badge = document.createElement("span");
    badge.className = "legend-icon-badge";
    const img = document.createElement("img");
    // "exit" has no fixed icon (it's direction-based, see icons.js) - the
    // up-arrow stands in as the representative glyph in the key.
    img.src = icon || EXIT_ARROW_ICON.up;
    img.alt = "";
    badge.appendChild(img);

    const text = document.createElement("span");
    text.className = "legend-label";
    text.textContent = label;

    row.appendChild(badge);
    row.appendChild(text);
    list.appendChild(row);
  }

  let expanded = window.innerWidth > 640;
  root.classList.toggle("collapsed", !expanded);
  toggleBtn.setAttribute("aria-expanded", String(expanded));

  toggleBtn.addEventListener("click", () => {
    expanded = !expanded;
    root.classList.toggle("collapsed", !expanded);
    toggleBtn.setAttribute("aria-expanded", String(expanded));
    clampHeight();
  });

  // The key is docked bottom-right and grows upward as it expands, while
  // #controls (search/floor picker/reset/landscape) is docked top-right and
  // grows downward. On short viewports - or once #controls picks up more
  // buttons after this panel is created - the two can otherwise grow into
  // each other. Rather than guess a fixed max-height, measure #controls'
  // actual bottom edge and cap the key so its top edge never passes it.
  function clampHeight() {
    if (!expanded) {
      root.style.maxHeight = "";
      return;
    }
    const controls = document.getElementById("controls");
    const controlsBottom = controls ? controls.getBoundingClientRect().bottom : 0;
    const CLEARANCE = 16; // px of breathing room between the two panels
    const available = window.innerHeight - controlsBottom - CLEARANCE;
    root.style.maxHeight = `${Math.max(120, available)}px`;
  }

  // #controls keeps gaining buttons/panels after createLegend() runs (see
  // main.js), and its own height changes as floors/search results render,
  // so re-measure on resize and whenever #controls itself resizes.
  window.addEventListener("resize", clampHeight);
  const controlsEl = document.getElementById("controls");
  if (controlsEl && "ResizeObserver" in window) {
    new ResizeObserver(clampHeight).observe(controlsEl);
  }
  // Defer the first measurement a tick so buttons main.js appends *after*
  // calling createLegend() are already in the DOM and counted.
  requestAnimationFrame(clampHeight);

  return { root };
}
