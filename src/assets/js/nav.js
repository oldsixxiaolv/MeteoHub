/* nav.js · mobile drawer toggle */
(function () {
  "use strict";

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-toggle]");
    if (!btn) return;
    e.preventDefault();
    const target = document.querySelector(btn.getAttribute("data-nav-toggle") || ".nav");
    if (!target) return;
    const open = target.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Close drawer on link click (mobile)
  document.querySelectorAll(".nav a").forEach((a) => {
    a.addEventListener("click", () => {
      const target = document.querySelector(".nav");
      if (target) target.classList.remove("is-open");
      const btn = document.querySelector("[data-nav-toggle]");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  });
})();
