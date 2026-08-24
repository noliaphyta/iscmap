import { FLOORS, dataPath } from "./mapConfig.js";

// Builds a flat index of every room across every floor so search works
// globally, not just on the currently displayed floor.
export async function buildSearchIndex() {
  const index = [];
  const requests = FLOORS.map((floor) =>
    fetch(dataPath(floor))
      .then((res) => res.json())
      .then((data) => {
        for (const room of data.rooms || []) {
          index.push({ id: room.id, floor });
        }
      })
      .catch(() => {
        // A floor without data yet shouldn't break search for the rest.
      })
  );

  await Promise.all(requests);
  return index;
}

export function createSearchBox({ index, onSelect }) {
  const root = document.createElement("div");
  root.className = "search-box";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "FIND A ROOM";
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

  function selectMatch(match) {
    onSelect(match);
    results.innerHTML = "";
    results.hidden = true;
    input.value = match.id;
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
      .filter((r) => r.id.toLowerCase().includes(query))
      .slice(0, 8);

    results.hidden = false;

    if (matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = "No rooms found.";
      results.appendChild(empty);
      return;
    }

    for (const match of matches) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-result";
      item.textContent = `${match.id} — Floor ${match.floor}`;
      item.addEventListener("click", () => selectMatch(match));
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

  return root;
}
