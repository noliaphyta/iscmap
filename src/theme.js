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

export function createThemeToggle() {
  const root = document.createElement("button");
  root.className = "theme-toggle-btn";
  root.type = "button";

  let theme = resolveInitialTheme();

  function applyTheme(next) {
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
  }

  root.addEventListener("click", () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  });

  applyTheme(theme);

  return { root };
}
