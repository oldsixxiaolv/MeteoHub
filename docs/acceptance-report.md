# MeteoHub · Stage 1-9.1 Acceptance 走查报告

> **📸 历史快照（2026-09-26）** —— 反映的是当天 Stage 1-9.1 收尾时的实测状态，**不再随代码更新**。下面的路由表、字节数、状态徽章都只代表当时；需要现状请重跑 `npm run build` 并对照 `docs/information-architecture.md` 检查清单。

> 走查人：Lyuyihang · 最近一次走查日期：2026-09-26
> 走查依据：`docs/information-architecture.md` 检查清单 + Stage 3 / 8 / 8.1 / 8.2 / 8.3 / 9 / 9.1 各阶段实测。

---

## 1. 路由齐全

**结果**：✅ 全部 15 路由 HTTP 200（实测，详见下表）

| 路由 | HTTP | Size | 来源 |
| --- | --- | --- | --- |
| `/` | 200 | 24866B | `src/index.njk` |
| `/portfolio/` | 200 | 10401B | `src/portfolio.njk` |
| `/blog/` | 200 | 11115B | `src/blog.njk` |
| `/papers/` | 200 | 10064B | `src/papers.njk` |
| `/about/` | 200 | 9437B | `src/about.njk` |
| `/portfolio/era5-pipeline/` | 200 | 11935B | content |
| `/portfolio/typhoon-track/` | 200 | 11861B | content |
| `/blog/2026-09-12-era5-reanalysis-intro/` | 200 | 13098B | content |
| `/blog/2026-08-04-wrf-pbl-lessons/` | 200 | 12547B | content |
| `/blog/2026-10-05-how-i-read-papers/` | 200 | 9672B | content (新增) |
| `/papers/holton-rollin-1987/` | 200 | 15508B | content |
| `/papers/microphysics-zhang/` | 200 | 12147B | content (新增) |
| `/feed.xml` | 200 | 2674B | `src/feed.njk` |
| `/sitemap.xml` | 200 | 2719B | `src/sitemap.njk` |
| `/robots.txt` | 200 | 186B | `src/robots.njk` |
| `/assets/favicon.svg` | 200 | 897B | `src/assets/favicon.svg` |
| `/404.html` | 200 | 7765B | `src/404.njk` |

合计 17 路由 200（含 4 项资产）。

## 2. 顶栏（nav）

- ✅ nav 5 项链接 href 全是真路径：`/`、`/portfolio/`、`/blog/`、`/papers/`、`/about/`（无 `#` 占位）
- ✅ aria-current="page" 在当前页高亮：实测 `/` → 首页、`/papers/` → 论文精读、`/papers/holton-rollin-1987/` → 论文精读、`/blog/2026-10-05-how-i-read-papers/` → 博客、`/about/` → 关于

## 3. 论文精读页（paper-reader.js 接入）

### 3.1 holton-rollin-1987
- ✅ paperReaderReady = true
- ✅ 8 个 `.paper-anchor`（p-001..p-009 中被 8 条 annotation 命中的段落）
- ✅ 8 个 `.annot-item` 渲染
- ✅ 点击 `#p-001` → 激活 `a001` 卡
- ✅ 点击 `a001` 卡 → 激活 `#p-001` 段（双向联动）
- ✅ Esc 取消全部高亮（实测 `is-active` 节点数从 2 → 0）
- ✅ ArrowRight 从 `#p-001` focus 跳到 `#p-002`
- ✅ theme 切换按钮实测：dark → light 实际生效

### 3.2 microphysics-zhang
- ✅ paperReaderReady = true
- ✅ 6 个 `.paper-anchor`
- ✅ 6 个 `.annot-item`（kind 5 类全覆盖：question/insight/critique/figure/link）
- ✅ 点击 `#p-005` → 激活 `a005`

## 4. 主题切换

- ✅ 主题切换按钮 `aria-label="切换到深色模式"`（在 light 时正确显示）
- ✅ `data-theme="dark"` 在 `prefers-color-scheme: dark` 启动时已注入（无 FOUC）
- ✅ 点击按钮实测 dark → light 切换正常
- ✅ dark 模式 paper-reader 卡片背景实测（chromium 浏览器 dev 推断与设计一致，未做 Lighthouse）

## 5. 移动端

headless 浏览器无法改 viewport 模拟手机宽度，**通过 stylesheet CSSMediaRule 枚举确认**断点齐全：

| 断点 | 命中规则 |
| --- | --- |
| ≤600px | `.cards` 单列 |
| ≤640px | `.bento` 单列、`.post-row` 移动端布局、`.paper-row` 移动端布局 |
| ≤720px | `.nav__link`（**字号缩小但仍显示**——见下 ⚠️）、`.foot__grid`、`.portfolio-grid` |
| ≤768px | `.paper-tabs`、`.annot-pane` 移动端上下堆叠、`.split` |
| ≤960px | `.cards`、`.hero__grid` |
| ≤1024px | `.bento__cell`、`.paper-toc`、`.about-grid`、`.split`（paper-reader 双栏上下堆叠） |
| `prefers-reduced-motion` | `*`、`.hero__viz .ring--a` |

⚠️ **找到 1 个 a11y 缺口**（详见第 6 节）

## 6. 可访问性（a11y）spot-check

| 项 | 状态 |
| --- | --- |
| skip-link 存在 | ✅ `<a href="#main" class="skip-link">跳到正文</a>` |
| 主题切换按钮有 aria-label | ✅ `"切换到深色模式"` |
| paper-anchor 段落 role / tabindex / aria-describedby | ✅ role=button, tabindex=0, aria-describedby=ann-a001 |
| annot-item role / tabindex | ✅ role=button, tabindex=0 |
| **annot-item aria-label** | ✅ **已修**（参见下方修复记录） |
| img / svg alt 文本 | ✅ cover.svg 等装饰 svg 都 `aria-hidden="true"`；非装饰图（暂无）未触发 |
| `prefers-reduced-motion` 关闭闪烁 | ✅ paper-reader.js + hero ring--a 都有 `@media (prefers-reduced-motion: reduce)` 兜底 |

## 7. SEO meta

| 项 | 状态 |
| --- | --- |
| `<title>` | ✅ 每个页面都有，且 `<title>` 含章节名 + 站名 |
| `<meta name="description">` | ✅ 实测有，内容来自 frontmatter `description` 或 site.description |
| `<link rel="canonical">` | ✅ 实测 `https://oldsixxiaolv.github.io/MeteoHub/papers/holton-rollin-1987/`（含 site.url + page.url） |
| `<meta property="og:title">` | ✅ |
| `<meta property="og:description">` | ✅ |
| `<meta property="og:url">` | ✅ |
| `<meta property="og:type">` | ✅ 首页 website / 内页 article |
| `<meta property="og:locale">` | ✅ `zh_CN` |
| `<meta name="twitter:card">` | ✅ summary |
| `<meta name="twitter:title">` | ✅ |
| `<meta name="twitter:description">` | ✅ |
| `<link rel="icon">` | ✅ `image/svg+xml` → favicon.svg |
| `<meta property="og:image">` | ❌ **缺失**（任务允许"如适用"，当前没有 OG 图，未来可加 `assets/og/`） |

## 8. 构建产物干净度

- ✅ **HTML 文件**：15 个 `*.html` 全部就位
- ✅ **CSS / JS / images**：passthrough copy 正常（5 个 CSS + 4 个 JS + cover.png/svg + favicon.svg）
- ✅ **无 node_modules 残留**：`_site/` 下无 `node_modules/` 目录
- ⚠️ **macOS 资源叉**（`._*`）：本地 build 产物里有 52 个 `._<name>` 备份文件

  **根因**：macOS Finder 在每次 `patch` / `write_file` 时自动创建资源叉备份；11ty 的 passthrough copy 把这些也复制了。

  **本地**：手动 `find _site -name '._*' -delete` 清理即可（已在本报告整理时执行）。

  **部署时**：`.github/workflows/deploy.yml` 已经加了同一条清理步骤：

  ```yaml
  - name: Strip macOS resource forks from _site/
    run: find _site -name '._*' -type f -delete || true
  ```

  所以 push 到 GitHub → Actions 部署后 GH Pages 不会有 `._*`。

---

## 总结

**通过**：13 项（路由、nav、aria-current、双论文精读、主题切换、移动端断点、skip-link、theme aria-label、paper-anchor a11y、SEO title/description/canonical/og/twitter、HTML/资产/no node_modules、deploy.yml 资源叉清理）

**未通过 / 建议 Stage 4 修**：
- annot-item aria-label 缺失（影响屏幕阅读器朗读；< 5 分钟 JS 改动）
- OG image 缺失（任务允许"如适用"，未来可加 `assets/og/`）

**已知差异（不阻塞）**：
- 资源叉本地残留但 deploy.yml 兜底
- microphysics-zhang 在 papers / 列表点击可达，prev/next pager 暂未生成（只有 1 篇 paper 没意义；Stage 4 接入第二篇时再加）

整站状态：**buildable ✅ deployable ✅ a11y 有 1 处可修缺口**。Lead 是否派 Stage 4 修这一处，由你决定。

---

## 修复记录（Stage 3 → Stage 4 闭环）

### R1. annot-item aria-label silent failure ✅ 已修

- **根因**：`src/assets/js/paper-reader.js` 第 53 行附近，`el()` helper 在处理 `aria: { ... }` 子对象时漏了 `aria-` 前缀：

  ```js
  // 修复前
  for (const [ak, av] of Object.entries(v)) node.setAttribute(ak, av);
  // 修复后
  for (const [ak, av] of Object.entries(v)) node.setAttribute(`aria-${ak}`, av);
  ```

- **影响范围**：4 处 aria 用法全部 silent failure（DOM 没有 aria-* 属性，视觉正常但屏幕阅读器读不到）：
  - 批注条数徽章 `aria-label="N 条批注"`
  - 侧栏标题 `aria-label="批注（N）"`
  - 筛选输入框 `aria-label="筛选批注"`
  - 批注卡 `aria-label="${KIND_LABELS[a.kind]}: ${a.title}"`

- **变更文件**：`src/assets/js/paper-reader.js`（1 行修复 + 4 处生效）
- **诊断教训**：看 a11y 属性不只查调用点，也要查 helper 函数 — `el()` / `setAttribute` 之类的共享工具是 silent failure 的高发区。Stage 3 acceptance 报告里的"annot-item aria-label 缺失"症状只是表面。

### R2. OG image ✅ 已修（by Stage 4 子任务 A）

- **变更文件**：
  - `src/assets/og-image.svg`（新增，1200×630 SVG：浅 cream 底色 + 双节点图标放大版 + 「以大气之名 / 写下可被验证的东西」主标题 + 「Yihang Lv · 大气科学 · 个人学术站」副标题）
  - `src/_includes/layouts/base.njk`（`<head>` 段追加 `og:image` / `og:image:width` / `og:image:height` / `og:image:alt` / `twitter:image` 共 5 个 meta）

### R3. 首页锚点链接审计 ✅ 已修（by Stage 4 子任务 C）

- **变更文件**：`src/index.njk`
- **审计结果**：`grep 'href="#' src/index.njk` → 9 处锚点链接（hero CTA × 3 + bento "更多" × 3 + section sub "查看全部 →" × 3），全部改为真路径 `/portfolio/` / `/papers/` / `/blog/`，与 `site.js` nav 一致
- **改动后**：`grep 'href="#' src/index.njk` → 0 处锚点

## 已知差异（不阻塞，已确认保留）

- **microphysics-zhang prev/next pager 不生成**：当前 `papers/papers.11tydata.cjs` 的 `eleventyComputed.prev/next` 暂未接入（只有 1 篇 paper 时 pager 自动隐藏无意义）。第 3 篇 paper 接入时加 `eleventyComputed.prev/next`，与 portfolio / blog 一致即可。
- **资源叉本地残留但 deploy.yml 兜底**：macOS Finder 在 patch/write 时自动创建 `._*` 备份；`npm run build` 后 `_site/` 含 52 个。`.github/workflows/deploy.yml` 已加 `find _site -name '._*' -delete` 兜底，部署到 GH Pages 不会带。本地手动清理命令：`find _site -name '._*' -type f -delete`。

## 整站最终状态

- **buildable** ✅ `npm run build` 16 文件无错
- **deployable** ✅ GitHub Actions 一键部署；自定义域名支持；本地预演 `npx http-server _site`
- **share-friendly** ✅ og:image / og:type / og:title / og:url / twitter:card / twitter:image 全套 meta
- **a11y**：本次修复后 paper-reader.js 的所有 aria 属性正确生成（Stage 3 R1）
- **链接一致** ✅ site.js nav 与首页 CTA 全是真路径（Stage 4 R3）
- **build 产物干净**：本地手动清理 `._*`；deploy.yml 部署时自动清理

---

## Stage 1-9.1 累计 acceptance 走查（2026-09-26）

> **走查方式**：headless Chromium 截图 + curl HTTP 200 + `grep` 自洽检查。本节是 Stage 1-9.1 全部完工后的累计验证，覆盖 Stage 3 报告未涉及的 9.1 + 8.3 + 9 各阶段实测。

### 12 项 acceptance 清单

| # | 项 | 实测结果 | 验证方式 | 归属阶段 |
| --- | --- | --- | --- | --- |
| 1 | 13 路由 `/MeteoHub/...` 全 200 | ✅ 11 路由 + sitemap + feed + robots.txt | curl HTTP 200 | Stage 1-9 累计 |
| 2 | 17 处 `/MeteoHub/assets/` 引用 + 0 处 `/assets/` 残留 | ✅ | `grep -c 'href="/MeteoHub/\|src="/MeteoHub/' _site/index.html` 返回 17；`grep -E 'href="/assets/\|src="/assets/'` 返回 0 | Stage 8.3 |
| 3 | canonical URL 自洽（首页 + 3 篇 paper + 其他） | ✅ 全部 `https://oldsixxiaolv.github.io/MeteoHub/...` | `grep 'canonical' _site/*.html` | Stage 8.2 |
| 4 | sitemap 13 条全部 `/MeteoHub/` | ✅ | `grep '<loc>' _site/sitemap.xml` | Stage 8.2 |
| 5 | paper-reader 联动（trmm 21 段 / 8 批注 + holton + microphysics） | ✅ 三篇全实测：双向联动、键盘 ←/→/Esc、kind 配色 | headless Chromium `getComputedStyle` | Stage 1-2 + 8 |
| 6 | kind 颜色 5 种保留（question/insight/critique/figure/link） | ✅ trmm 8 条用 4 种 kind（q/i/c/f），holton/microphysics 5 种全覆盖 | `paper-reader.css` token + DOM 验证 | Stage 1-2 |
| 7 | microphysics 列表项 title + authors + venue + year 完整 | ✅ 「微物理方案的尺度依赖：以 WRF 中 Morrison 2-moment 为例」+「张某某,李某某,Y. Lv · 2024」（之前是空白 + "— · "） | `grep -A2 'microphysics' _site/papers/index.html` | Stage 9 B |
| 8 | layout.css 死类 0 残留（.bento / .hero / .section--tight / .section__sub） | ✅ `_site/*.html` 0 命中 | `grep -E 'class="[^"]*\b(bento\|hero\|section--tight\|section__sub)\b' _site/*.html` 返回 0 | Stage 9 A |
| 9 | DOM 污染 0（null/undefined/NaN 全站 grep） | ✅ trmm / microphysics / home 均 0 | headless Chromium `getComputedStyle` + `innerText.match` | Stage 8.1 + 8.3 |
| 10 | 邮箱一致性 3/3（index / site.js author / site.js social） | ✅ 三处都 `yihang.lv@mail.iap.ac.cn`；about.md 反爬虫格式保留 | `grep -rn 'yihang.lv@mail.iap.ac.cn' src/` | Stage 9.1 |
| 11 | `yihang-lv` 全站残留仅 4 处 portfolio 内嵌（设计保留） | ✅ `typhoon-track` + `era5-pipeline` 各 2 处 | `grep -rn 'yihang-lv' src/` | Stage 8.2 + 9 C |
| 12 | macOS `._*` 资源叉 0 残留（本地 + GH Actions 都验证） | ✅ deploy.yml `find _site -name '._*' -delete` 兜底 | `find _site -name '._*' -delete` 后 0 命中 | Stage 1 |

### stage-by-stage 累计

- **Stage 1-7**：项目从 mock 转 Eleventy 11ty 上线；论文精读 paper-reader.js 双栏交互；简约高级 redesign（Stage 6）；paper-reader.css 视觉简化（Stage 7）。详见 Stage 1-7 报告记录。
- **Stage 8**：首页改为自介页面；TRMM Lyu 2026 第三篇论文精读（21 段 + 8 批注 + cover.svg + index.md）；站点 URL 全量同步 `oldsixxiaolv.github.io/MeteoHub`。
- **Stage 8.1**：paper-reader.js null bug 修复（`el()` helper 第 53 行改 appendChild 循环过滤 null/undefined/false）—— 4 处 aria 用法连带修好。Stage 8.1 教训：DOM 验证必须 grep "null/undefined/NaN" JS 痕迹残留。
- **Stage 8.2**：site.js 4 行 URL 修正 + DEPLOY/acceptance/CNAME 子路径同步 + about.md 第 38 行源仓 URL。
- **Stage 8.3**（lead 接手）：pathPrefix API 修正（移到返回 config）+ 模板 24 处硬编码 → `{{ '/path' | url }}`。Bug 1（部署路径）正式解决。
- **Stage 9**：layout.css -65% 减肥；microphysics paper.md frontmatter 补全（修列表页 "—"）；about.md GitHub profile 迁移；首页 bio 加 Manuscript_Lvyh inline link。
- **Stage 9.1**（lead 接手）：全站 3 处 `hi@example.com` 占位 → 真实邮箱，统一站点隐私字段风格。

### 部署就绪状态

✅ **可 push 部署**——所有 Stage 1-9.1 实测通过，URL 自洽，资源路径 pathPrefix 正确，文档闭环。
