// Creates the DOM for the floor-select control: a plain vertical stack of
// squared, buttons (elevator-panel style). This is a fixed overlay div
// (not a Leaflet control layer) so it never moves or scales when the map
// pans/zooms - floor switching has to feel instant.
//
// Levels are now dynamic (derived from the geojson by src/geoData.js), not
// a hardcoded list - `levels` is passed in already sorted top-first (e.g.
// ["4","3","2","1","B"]) rather than imported from mapConfig.
export function createControlPanel({ levels, onSelectLevel }) {
  const root = document.createElement("div");
  root.className = "control-panel";

  const floorStack = document.createElement("div");
  floorStack.className = "floor-stack";
  root.appendChild(floorStack);

  function render(currentLevel) {
    floorStack.innerHTML = "";
    for (const level of levels) {
      const btn = document.createElement("button");
      btn.className = "floor-btn" + (level === currentLevel ? " active" : "");
      btn.textContent = level;
      btn.setAttribute("aria-label", `Floor ${level}`);
      btn.addEventListener("click", () => onSelectLevel(level));
      floorStack.appendChild(btn);
    }
  }

  return { root, render };
}
