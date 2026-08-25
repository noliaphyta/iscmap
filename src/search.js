// Indexes every feature with a non-empty room_number, regardless of
// whether its geometry is null - a null-geometry room can still
// legitimately be a search result, it just can't be zoomed to (the caller
// handles that case; see main.js). The index itself is built once by
// geoData.js and passed in here, since the geojson is loaded up front now
// rather than per-floor on demand.
export function createSearchBox({ index, levelOf, canonicalLevel, onSelect }) {
  const root = document.createElement("div");
  root.className = "search-box";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "SEARCH ROOM NUMBER";
  input.setAttribute("aria-label", "Search for a room");

  const results = document.createElement("div");
  results.className = "search-results";
  results.hidden = true;

  root.append(input, results);

  let activeIndex = -1;

  function setActive(i) {
    const items = results.querySelectorAll(".search-result");
    items.forEach((el) => el.classList.remove("active"));
    activeIndex = i;
    if (items[i]) {
      items[i].classList.add("active");
      items[i].scrollIntoView({ block: "nearest" });
    }
  }

  function selectMatch(feature) {
    onSelect(feature);
    results.innerHTML = "";
    results.hidden = true;
    input.value = feature.properties.room_number;
  }

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    results.innerHTML = "";
    activeIndex = -1;
    if (!query) {
      results.hidden = true;
      return;
    }

    const matches = index
      .filter((f) => f.properties.room_number.toLowerCase().includes(query))
      .slice(0, 8);

    results.hidden = false;

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No rooms found.";
      results.appendChild(empty);
      return;
    }

    for (const feature of matches) {
      const level = canonicalLevel(levelOf(feature.properties.floor_label));
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-result";
      item.textContent = `${feature.properties.room_number} — Floor ${level}`;
      item.addEventListener("click", () => selectMatch(feature));
      results.appendChild(item);
    }
  });

  input.addEventListener("keydown", (e) => {
    const items = results.querySelectorAll(".search-result");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((activeIndex + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((activeIndex - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
    } else if (e.key === "Escape") {
      results.innerHTML = "";
      results.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-box")) {
      results.hidden = true;
    }
  });

  return root;
}
