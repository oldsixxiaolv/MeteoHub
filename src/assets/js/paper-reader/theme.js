/* paper-reader/theme.js
 * ---------------------------------------------------------------------------
 * Paper-specific theme reactivity.
 *
 * Why this exists as a separate module:
 *   · The global theme toggle (theme.js, loaded via main.js on every page)
 *     writes to <html data-theme="…"> but does not know about paper pages.
 *   · Paper-reader renders SVG icons that inherit currentColor, so they
 *     automatically follow theme changes — but if a future paper-only module
 *     needs to react (rebuild canvas overlays, recompute IntersectionObserver
 *     thresholds, reflow the sticky pane on color-scheme changes, …), it
 *     should subscribe via `onThemeChange(cb)` exported here.
 *
 * Phase 2B.6: extracted from the monolithic paper-reader.js as the dedicated
 * seam between global theme and paper-reader features.
 * ------------------------------------------------------------------------- */

const subscribers = new Set();

function readTheme() {
  return (
    document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );
}

/**
 * Subscribe to theme changes. Callback receives the new theme ("light" | "dark").
 * Returns an unsubscribe function.
 */
export function onThemeChange(cb) {
  subscribers.add(cb);
  // Fire once immediately so subscribers can sync to current state.
  try { cb(readTheme()); } catch { /* subscriber crashed; don't break init */ }
  return () => subscribers.delete(cb);
}

/** Manually broadcast the current theme — useful after imperatively changing it. */
export function broadcast() {
  const t = readTheme();
  for (const cb of subscribers) {
    try { cb(t); } catch { /* keep going */ }
  }
}

// ---- React to attribute changes on <html> ----
let observer = null;
function attachObserver() {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "data-theme") {
        broadcast();
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

// ---- React to system theme changes when user hasn't picked one ----
function attachSystemListener() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    // Only broadcast if user hasn't explicitly set a theme.
    // localStorage 在「隐私模式 / 禁用 cookie」的 Safari 上访问会直接抛
    // SecurityError（不是返回 null），不包 try/catch 会让整个回调炸掉。
    let userChosen = null;
    try { userChosen = localStorage.getItem("meteohub-theme"); } catch (_) {}
    if (!userChosen) broadcast();
  };
  mq.addEventListener?.("change", onChange);
}

export function init(_ctx) {
  attachObserver();
  attachSystemListener();
  // Initial broadcast so any subscriber that mounted before us gets the value.
  broadcast();
}

export default { init, onThemeChange, broadcast, readTheme };
