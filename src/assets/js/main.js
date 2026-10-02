/* main.js · entry: theme + nav + reading progress + motion utils */
import "./theme.js";
import "./nav.js";

// Reveal content as it enters the viewport without hiding it when JS is unavailable.
(function initReveal() {
  const nodes = [...document.querySelectorAll("[data-reveal]")];
  if (!nodes.length) return;

  // Keep the static page visible until the enhancement is ready.
  document.documentElement.classList.add("motion-ready");
  nodes.forEach((node) => {
    const delay = Number(node.dataset.revealDelay || 0);
    node.style.setProperty("--reveal-delay", `${delay}ms`);
    node.classList.add("reveal");
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      instance.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8%" });

  nodes.forEach((node) => observer.observe(node));
})();

/* main.js · entry: theme + nav + reveal motion
 *
 * 阅读进度条不在这里：paper-reader/reading-progress.js 是它的正式实现
 * （原 main.js §2 的 IIFE 已搬过去），paper 页由 paper.njk 动态 import 挂载。
 * 两份都留着会让 paper 页注册两个 scroll 监听、同一个 bar 被写两次宽度。 */

// Current year in footer
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
