/* ============================================================================
 * src/content/papers/papers.11tydata.cjs · papers 子目录默认 front-matter
 * ========================================================================== */
const { getSlugFromData } = require("../../eleventy-helpers.cjs");

module.exports = {
  layout: "layouts/paper.njk",
  permalink: (data) => `/papers/${getSlugFromData(data)}/`,
  // 把当前论文的 slug 显式暴露给 layout（layout 中 page 对象指向 layout 自身，
  // 不能直接用 page.fileSlugStem 拿到内容页 slug）
  eleventyComputed: {
    slug: (data) => getSlugFromData(data),
  },
  tags: ["papers"],
};