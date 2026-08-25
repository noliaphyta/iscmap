import { CATEGORY_STYLE } from "./mapConfig.js";
import { categoryIconFileForKey } from "./icons.js";

// Creates the DOM for the legend/key panel: a swatch + label per room
// category, sourced from CATEGORY_STYLE so it can't drift out of sync with
// what's actually drawn on the map. Static key only - no per-category
// filter checkboxes, no interactivity beyond the existing collapse toggle.
// An icon is shown next to a category's swatch only where one applies
// (i.e. that category has its own fallback icon - see icons.js); most
// icons are subcategory-driven and don't correspond to a single category,
// so they're deliberately left out of the key to keep it short.
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

  for (const [key, { fill, label }] of Object.entries(CATEGORY_STYLE)) {
    const row = document.createElement("div");
    row.className = "legend-row";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.background = fill;
    row.appendChild(swatch);

    const iconFile = categoryIconFileForKey(key);
    if (iconFile) {
      const img = document.createElement("img");
      img.className = "legend-icon";
      img.src = `icons/${iconFile}`;
      img.alt = "";
      row.appendChild(img);
    }

    const text = document.createElement("span");
    text.className = "legend-label";
    text.textContent = label;
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
  // #controls (search/floor picker/reset) is docked top-right and grows
  // downward. On short viewports the two can otherwise grow into each
  // other. Rather than guess a fixed max-height, measure #controls'
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

  window.addEventListener("resize", clampHeight);
  const controlsEl = document.getElementById("controls");
  if (controlsEl && "ResizeObserver" in window) {
    new ResizeObserver(clampHeight).observe(controlsEl);
  }
  requestAnimationFrame(clampHeight);

  return { root };
}
