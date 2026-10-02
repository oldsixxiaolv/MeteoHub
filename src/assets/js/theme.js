/* theme.js · light/dark mode toggle with localStorage persistence */
(function () {
  "use strict";

  const STORAGE_KEY = "meteohub-theme";
  const root = document.documentElement;

  function getSystem() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function apply(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
    // Update all toggle buttons
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      const current = root.getAttribute("data-theme") || getSystem();
      btn.setAttribute("aria-pressed", current === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", current === "dark" ? "切换到浅色模式" : "切换到深色模式");
    });
  }

  // Initial: prefer saved → system
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (_) {}
  apply(saved || getSystem());

  // Toggle handler (event delegation)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    e.preventDefault();
    const current = root.getAttribute("data-theme") || getSystem();
    const next = current === "dark" ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    apply(next);
  });

  // React to system change (only if user has not explicitly chosen)
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      let userChosen = null;
      try { userChosen = localStorage.getItem(STORAGE_KEY); } catch (_) {}
      if (!userChosen) apply(e.matches ? "dark" : "light");
    };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }
})();
