const { getSlugFromData } = require("../../eleventy-helpers.cjs");

module.exports = {
  layout: "layouts/detail.njk",
  permalink: (data) => `/blog/${getSlugFromData(data)}/`,
  tags: ["blog"],
  eleventyComputed: {
    prev: (data) => {
      const all = (data.collections && data.collections.blog) || [];
      const idx = all.findIndex((it) => (it.url || "") === (data.page.url || ""));
      return idx > 0 ? all[idx - 1] : null;
    },
    next: (data) => {
      const all = (data.collections && data.collections.blog) || [];
      const idx = all.findIndex((it) => (it.url || "") === (data.page.url || ""));
      return idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
    },
  },
};