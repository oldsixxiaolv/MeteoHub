/* ============================================================================
 * eleventy-helpers.cjs · 11ty 内部共享工具
 * ----------------------------------------------------------------------------
 * 给 .11tydata.cjs 提供 page slug 解析逻辑（避免在每个目录文件里重复）。
 * 注意点：
 *  - 11ty v3 默认对 YYYY-MM-DD- 开头的 slug 会自动剥日期（因为 blog 设计是按
 *    /blog/<post>/ 路由，不需要日期前缀）；但本项目显式保留日期 slug，所以
 *    用 filePathStem 而非 fileSlug。
 *  - 对非 index 文件（paper.md），fileSlug 是文件名本身，需要从 filePathStem
 *    取所在目录。
 * ========================================================================== */
function getSlugFromData(data, options = {}) {
  const stem = (data.page && data.page.filePathStem) || "";
  // filePathStem 形如 "/content/papers/holton-rollin-1987/paper" 或
  //  "/content/blog/2026-08-04-wrf-pbl-lessons/index"
  const parts = stem.split("/").filter(Boolean);
  if (!parts.length) return "";
  const last = parts[parts.length - 1];
  // 两种文件形态都取"所在目录名"：
  //   index.md（/content/blog/<slug>/index）→ last === "index"
  //   paper.md（/content/papers/<slug>/paper）→ last === "paper"
  // 早先这里对 index / 非 index 写了两段完全相同的 return，已合并。
  return parts[parts.length - 2] || "";
}

module.exports = { getSlugFromData };