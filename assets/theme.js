(function () {
  var STORAGE_KEY = "site-theme-mode";
  var THEMES = ["light", "dark", "auto"];

  function getAutoTheme() {
    var hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? "light" : "dark";
  }

  function isReload() {
    try {
      var entries = performance.getEntriesByType("navigation");
      return entries.length > 0 && entries[0].type === "reload";
    } catch (e) {
      return false;
    }
  }

  function readMode() {
    if (isReload()) return "auto";
    try {
      var mode = sessionStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(mode) >= 0 ? mode : "auto";
    } catch (e) {
      return "auto";
    }
  }

  function writeMode(mode) {
    try {
      sessionStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {}
  }

  function resolveTheme(mode) {
    return mode === "auto" ? getAutoTheme() : mode;
  }

  function formatLabel(mode, resolvedTheme) {
    if (mode === "auto") {
      return "Theme: Auto (currently " + (resolvedTheme === "dark" ? "Dark" : "Light") + ")";
    }
    return "Theme: " + (mode === "dark" ? "Dark" : "Light");
  }

  function applyTheme(mode) {
    var resolvedTheme = resolveTheme(mode);
    var root = document.documentElement;

    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-theme", resolvedTheme);

    var toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      var label = formatLabel(mode, resolvedTheme);
      toggle.setAttribute("aria-label", label + ". Activate to switch mode.");
      toggle.setAttribute("title", label);
    }
  }

  function nextMode(mode) {
    var index = THEMES.indexOf(mode);
    return THEMES[(index + 1) % THEMES.length];
  }

  var currentMode = readMode();
  applyTheme(currentMode);

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector("[data-theme-toggle]");

    if (toggle) {
      toggle.addEventListener("click", function () {
        currentMode = nextMode(currentMode);
        writeMode(currentMode);
        applyTheme(currentMode);
      });
    }

    window.setInterval(function () {
      if (currentMode === "auto") {
        applyTheme(currentMode);
      }
    }, 60000);
  });
})();
