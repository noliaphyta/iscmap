import { FLOORS } from "./mapConfig.js";

// Creates the DOM for the floor-select control: a plain vertical stack of
// squared, numbered buttons (elevator-panel style). This is a fixed
// overlay div (not a Leaflet control layer) so it never moves or scales
// when the map pans/zooms - floor switching has to feel instant.
export function createControlPanel({ onSelectFloor }) {
  const root = document.createElement("div");
  root.className = "control-panel";

  const floorStack = document.createElement("div");
  floorStack.className = "floor-stack";
  root.appendChild(floorStack);

  function render(currentFloor) {
    floorStack.innerHTML = "";
    const floors = [...FLOORS].sort((a, b) => b - a);
    for (const floor of floors) {
      const btn = document.createElement("button");
      btn.className = "floor-btn" + (floor === currentFloor ? " active" : "");
      btn.textContent = floor;
      btn.setAttribute("aria-label", `Floor ${floor}`);
      btn.addEventListener("click", () => onSelectFloor(floor));
      floorStack.appendChild(btn);
    }
  }

  return { root, render };
}
