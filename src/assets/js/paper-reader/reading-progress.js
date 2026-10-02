/* paper-reader/reading-progress.js
 * ---------------------------------------------------------------------------
 * Top-of-page reading progress bar (paper pages only).
 * Independent — runs immediately, no DOM dependencies beyond [data-reading-progress].
 * Original main.js §2 (reading-progress IIFE) lifted into its own module so it
 * is fetched only on paper pages.
 * ------------------------------------------------------------------------- */

export function init(ctx) {
  const bar =
    ctx.paperRoot?.querySelector("[data-reading-progress]") ||
    document.querySelector("[data-reading-progress]");
  if (!bar) return;

  let ticking = false;
  function update() {
    const h = document.documentElement;
    const b = document.body;
    const st = h.scrollTop || b.scrollTop || 0;
    const sh = (h.scrollHeight || b.scrollHeight || 0) - h.clientHeight;
    const pct = sh > 0 ? (st / sh) * 100 : 0;
    bar.style.width = Math.min(100, Math.max(0, pct)) + "%";
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );
  update();
}

export default { init };
