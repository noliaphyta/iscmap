// Theme toggle button: flips <html data-theme="..."> between "light" and
// "dark" and persists the choice. Mirrors the inline anti-flash script in
// index.html (same storage key, same resolution order: explicit stored
// choice wins, else fall back to the OS preference) so this module only
// ever confirms/updates the theme index.html already applied pre-paint -
// it never causes a flash itself.
const STORAGE_KEY = "campus-map-theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveInitialTheme() {
  // If index.html's inline script already set data-theme, trust it instead
  // of re-deriving from scratch (avoids a mismatch if storage/matchMedia
  // become unavailable between the two scripts running).
  return (
    document.documentElement.getAttribute("data-theme") ||
    getStoredTheme() ||
    (systemPrefersDark() ? "dark" : "light")
  );
}

// onThemeChange is called *after* data-theme has been flipped on <html>,
// so anything that reads a --theme-dependent computed style (e.g.
// roomLayer.js's --ink-based strokeColor, captured once per renderRooms
// call rather than live) gets a chance to re-render against the fresh
// value. Without this, room outlines silently keep whatever color was
// current at the last floor switch until the next one happens to occur.
export function createThemeToggle({ onThemeChange } = {}) {
  const root = document.createElement("button");
  root.className = "theme-toggle-btn";
  root.type = "button";

  let theme = resolveInitialTheme();

  function applyTheme(next, { notify = true } = {}) {
    theme = next;
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Storage can be unavailable (private browsing, disabled cookies) -
      // the toggle still works for the current session, it just won't
      // persist across reloads.
    }
    root.textContent = theme === "dark" ? "LIGHT MODE" : "DARK MODE";
    root.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    root.setAttribute("aria-pressed", String(theme === "dark"));
    if (notify && onThemeChange) onThemeChange(theme);
  }

  root.addEventListener("click", () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  });

  // Suppress the callback on this initial call: it only confirms/re-applies
  // whatever theme index.html's inline anti-flash script already set
  // pre-paint (see resolveInitialTheme above), and at this point in
  // main.js's init() nothing has rendered yet for onThemeChange to re-render.
  applyTheme(theme, { notify: false });

  return { root };
}
