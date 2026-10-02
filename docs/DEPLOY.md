# MeteoHub · GitHub Pages 部署说明

> 适用场景：把 Eleventy 构建出的 `_site/` 部署到 GitHub Pages。
> **实际仓库**：`oldsixxiaolv/MeteoHub`（project site），部署为 `https://oldsixxiaolv.github.io/MeteoHub/`。
> 部署通过 GitHub Actions 完成——push 到 `main` 后自动触发。

---

## 前置假设

- **本项目实际部署为 `https://oldsixxiaolv.github.io/MeteoHub/`**（项目页子路径）
- 仓库托管在 GitHub，main 分支受保护，需要 PR 流程
- 站点域名为以下两种之一：
  - **默认域** `oldsixxiaolv.github.io/MeteoHub` —— Pages 站点根路径是 `/MeteoHub/`，所有资产引用走 pathPrefix 派生（见「项目页路径前缀方案」节）
  - **自定义域** `meteohub.oldsixxiaolv.com` —— Pages 站点根路径是 `/`，但 `src/_data/site.js` 的 `site.url` 必须改成完整域名
- `src/_data/site.js` 中 `url` 字段已设 `https://oldsixxiaolv.github.io/MeteoHub`，**部署到自定义域前**改这个字段
- Node ≥ 18 已写进 `package.json` 的 `engines`，Actions 运行时按 `setup-node@v4` 配 20.x 即可

---

## 一键部署（GitHub Actions）

工作流文件在 **`.github/workflows/deploy.yml`**：push 到 main 自动构建并发布到 Pages。

```yaml
name: Deploy MeteoHub to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build (Eleventy → _site/)
        run: npm run build

      # 清理 macOS Finder 自动生成的 ._* 资源叉备份（与本地 dev 一致）
      - name: Strip macOS resource forks from _site/
        run: find _site -name '._*' -type f -delete || true

      # 复制仓库根的 CNAME 到 _site/（如果有自定义域名）
      - name: Copy CNAME into _site/
        run: |
          if [ -f CNAME ]; then cp CNAME _site/CNAME; fi

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

构建 job 输出 `_site/` 作为 artifact；deploy job 用官方 `actions/deploy-pages@v4` 发布到 GitHub Pages。

> 注意：workflow 里跑的是裸 `npm run build`，**没有**设 `NODE_ENV=production`。因此线上 `_site/assets/css/components.css` 是 dev 形态的 `@import` hub（7 次额外请求），而不是 7 个 partial 拼成的单文件。详见 `HOW_TO_RUN.md`「components.css 的两种生成方式」。

---

## 权限配置（Settings → Pages）

1. 仓库 **Settings → Pages**
   - **Source** 选 **GitHub Actions**（不是 "Deploy from a branch"）
   - 自定义域：在 **Custom domain** 输入 `meteohub.oldsixxiaolv.com`，勾选 **Enforce HTTPS**
2. 仓库 **Settings → Actions → General**
   - **Workflow permissions** 选 **Read and write permissions**（默认是只读，会让 deploy-pages 报 403）
   - 勾选 **Allow GitHub Actions to create and approve pull requests**

如果只读权限，workflow 会失败并报 `Error: HttpError: Resource not accessible by integration` —— 这是最常见的踩坑。

---

## 本地预演

工作流提交前先在本地跑一遍：

```bash
npm install
npm run build                  # 产出 _site/
find _site -name '._*' -delete # 删 macOS 资源叉（工作流也做这步）
npx http-server _site -p 8081  # 在 8081 起静态服务
# 浏览器打开 http://localhost:8081/ 验证：
# - 首页 / portfolio / blog / papers / about 都能开
# - /papers/holton-rollin-1987/、/papers/microphysics-zhang/、/papers/trmm-lyu-2026/
#   双栏 + 双向联动正常
# - dark/light 切换、aria-current 都正常
```

`http-server` 不识别就改 `python3 -m http.server 8081 --directory _site` 或 `npx serve _site -l 8081`。

---

## 自定义域名（CNAME / DNS）

### 1. 仓库加 CNAME 文件

仓库根放 **`CNAME`**（注意：无扩展名，内容只有一行）：

```
meteohub.oldsixxiaolv.com
```

仓库示例模板给了 **`CNAME.example`** 作为占位，部署时复制为 `CNAME` 并替换域名。

11ty 构建时仓库根的 `CNAME` 不会被自动拷贝到 `_site/`，所以工作流里已经有专门一步做这件事（见上节 YAML 的 `Copy CNAME into _site/`）：

```yaml
- name: Copy CNAME into _site/
  run: |
    if [ -f CNAME ]; then cp CNAME _site/CNAME; fi
```

`[ -f CNAME ]` 做了存在性判断，所以不切自定义域时留空即可，workflow 不会报错。

> 别把 `CNAME` 放进 `src/` 想靠 passthrough 带出去 —— `eleventy.config.js` 的 `addPassthroughCopy` 列表里没有这一项，不会生效。

### 2. DNS 配置

按 DNS 提供商不同：

- **Cloudflare**：
  - 添加 CNAME 记录：`meteohub.oldsixxiaolv.com` → `oldsixxiaolv.github.io`（开 Proxy）
  - 在 Cloudflare 的 **SSL/TLS** 选 Full (Strict)
- **DNSPod / 境内**：
  - 添加 CNAME 记录：`meteohub` → `oldsixxiaolv.github.io`（关 Proxy 不走 CDN）
  - 境外回源 GitHub IP（如有 4A 记录需要追踪 GitHub Pages 文档）
- **切到默认域**：在仓库 Settings → Pages 把 Custom domain 清空，等 5-10 分钟让 DNS 缓存刷新再访问 `oldsixxiaolv.github.io/meteohub`

### 3. `src/_data/site.js` 的 `url` 字段

`site.url` 是**完整 origin**，影响 sitemap.xml / RSS / canonical link / OG meta。
改了域名就把这一行：

```js
url: "https://meteohub.oldsixxiaolv.com"   // 自定义域
// 或
url: "https://oldsixxiaolv.github.io"     // 默认用户页
// 或
url: "https://oldsixxiaolv.github.io/MeteoHub"  // 默认项目页（注意路径前缀）
```

---

## 项目页路径前缀方案（Stage 8.3）

**问题**：部署到 GitHub Pages 项目页（如 `https://oldsixxiaolv.github.io/MeteoHub/`）时，如果模板里写死 `<link href="/assets/css/tokens.css">`，浏览器请求 `/assets/css/tokens.css` 会落到 `oldsixxiaolv.github.io/assets/css/tokens.css`（404，整站垮）。

**Stage 8.3 方案**（已应用，本项目使用）：

1. **eleventy.config.js** 在返回的 config 对象里设 `pathPrefix`（11ty v3 必须放在返回 config 里，不是挂在 `eleventyConfig` 上），并额外处理 dev / prod 分流：
   ```js
   let _siteUrl = "";
   try { _siteUrl = require("./src/_data/site.js").url || ""; } catch (_) {}
   let _pathPrefix = "/";
   try {
     const _u = new URL(_siteUrl);
     if (_u.pathname && _u.pathname !== "/") _pathPrefix = _u.pathname.replace(/\/$/, "");
   } catch (_) {}
   // 本地开发留在根路径；生产构建保留 Pages 前缀。
   // PATH_PREFIX 环境变量可强制覆盖（用来在本地复现线上前缀）。
   const _serveMode = process.argv.includes("--serve");
   const _configuredPrefix = process.env.PATH_PREFIX;
   const _effectivePathPrefix = _configuredPrefix || (_serveMode ? "/" : _pathPrefix);

   return { pathPrefix: _effectivePathPrefix, /* ... */ };
   ```
   因为 `--serve` 时前缀被降级为 `/`，dev server **不会**再把 `/` 重定向到 `/MeteoHub/` —— 直接开 `http://127.0.0.1:8080/` 即可。

2. **模板里硬编码 `/path` 全部改成 `{{ '/path' | url }}`**，例如：
   - `base.njk`：`href="{{ '/assets/css/tokens.css' | url }}"`
   - `paper.njk`：`href="{{ '/assets/css/paper-reader.css' | url }}"`
   - `header.njk` / `footer.njk` / `404.njk` / `index.njk` 同样
   - 11ty 的 `url` filter 在 `pathPrefix` 设置下会自动加 `/MeteoHub` 前缀

3. **`{{ site.url }}` 不受 pathPrefix 影响**——`site.url` 是 site.js 写死的完整 URL，自己负责 canonical / sitemap / OG meta 拼接。两者分工明确。

**验证步骤**（build 后必做）：
```bash
# 期望 0 命中（不应有硬编码 /assets/...）
grep -E 'href="/assets/|src="/assets/' _site/*.html

# 期望 ≥ 7 命中（应有 /MeteoHub/assets/... 前缀）
grep -c 'href="/MeteoHub/' _site/index.html
```

**适用项目**：所有需要部署到 GitHub Pages project site / 自定义域的 Eleventy 站点。

---

## 故障排查

### 1. build 成功但页面 404 / 资源 404

**症状**：`_site/index.html` 渲染了，但 CSS / JS / paper-reader.js 报 404。

**根因**：自定义域或子路径部署时，资产 URL 需要带 base URL。

**修复**：按「项目页路径前缀方案（Stage 8.3）」节配置 `pathPrefix` + `{{ '/path' | url }}` 模板表达式。本项目已采用 Stage 8.3 方案，**不存在**项目页路径前缀问题。

### 2. `site.url` 与 sitemap 不匹配

**症状**：sitemap 里的 `<loc>` 是 `https://oldsixxiaolv.github.io/...`，但实际部署在 `meteohub.oldsixxiaolv.com`。

**根因**：忘了改 `src/_data/site.js` 的 `url` 字段就部署了。

**修复**：改 `url` 后 push，工作流自动 rebuild。

### 3. `_site/` 被误提交到 git

**症状**：仓库历史里能看到 `_site/portfolio/...` 这些文件。

**根因**：`.gitignore` 没排除 `_site/`。

**修复**：
```bash
# 从 git 历史里清除
git rm -r --cached _site/
git commit -m "stop tracking _site/"
echo "_site/" >> .gitignore
```

本项目 `.gitignore` 已加 `_site/`，**通常不会** 出现这个问题。

### 4. paper-reader 加载失败 / 批注不显示

**症状**：双栏布局正常，但右侧批注侧栏空白。

**根因**：大概率是 `annotations.json` 404 —— 因为 `/assets/js/paper-reader/main.js` 用 fetch 拉它。

**修复**：
- 检查 `_site/content/papers/<slug>/annotations.json` 是否存在（由 `addPassthroughCopy("src/content/papers/**/annotations.json")` 拷贝）
- 如果部署到 Pages 后 404：可能是 base URL 不匹配导致浏览器把 `/content/...` 解析到 `oldsixxiaolv.github.io/content/...` 而非真实源
- 浏览器 DevTools → Network → 看 annotations.json 的实际请求 URL 与响应

> `paper-reader` 已是 `src/assets/js/paper-reader/` 下的 6 个 ESM 模块（main / toc / annotations / reading-progress / highlight / theme），由 `paper.njk` 动态 `import()` 入口。排查时以 `paper-reader/main.js` 为准，不再有单一 `paper-reader.js` 文件。

### 5. 404 页面路径不对

**症状**：访问不存在的路径时，Pages 返回 404，但显示的不是自定义的 `404.html`。

**根因**：Pages 默认 404 在 `_site/404.html`（需要文件名带 `.html` 而不是目录 `_site/404/index.html`）。

**修复**：本项目 `src/404.njk` 用 `permalink: /404.html`，build 产物路径正确。如果改动了，确认 permalink 是 `.html` 后缀。

### 6. dark mode 在某些浏览器不生效

**症状**：Safari 下 dark / light 切换无反应，或 OS 切 dark 后页面仍 light。

**根因**：`prefers-color-scheme` 媒体查询与 `[data-theme]` 属性层叠顺序问题。

**修复**：
- 确认 `src/assets/css/tokens.css` 在 `@media (prefers-color-scheme: dark)` 块里用 `:root:not([data-theme="light"])`
- `src/_includes/layouts/base.njk` 的早期 `<script>` 必须在 `<head>` 顶部（避免 FOUC）
- Safari 16+ 才完全支持 `color-mix()`，如果回退样式出问题，确认 `@supports not (background: color-mix(...))` 兜底分支存在

### 7. 首屏出现 "404 Not Found" 然后刷新正常

**症状**：第一次访问子路径 404，刷新一次正常。

**根因**：GitHub Pages 用 Fastly CDN，第一次访问 URL 时 CDN 节点还没缓存对应 404，会去 origin 取；origin 返回的 404 会被 CDN 缓存。

**修复**：等 5-10 分钟让 CDN 缓存刷新；或者清浏览器缓存重试。

---

## 部署后验证清单

- [ ] 域名能访问，HTTP 200
- [ ] 所有主路由（`/` `/portfolio/` `/blog/` `/papers/` `/about/`）HTTP 200
- [ ] `/papers/holton-rollin-1987/`、`/papers/microphysics-zhang/`、`/papers/trmm-lyu-2026/` 双栏可见，段落 id 与批注双向联动工作
- [ ] `/blog/2026-10-05-how-i-read-papers/` 可访问
- [ ] `/feed.xml` / `/sitemap.xml` / `/robots.txt` 可访问，Sitemap URL 与最终域名一致
- [ ] 浏览器 DevTools → Network 看 `assets/js/paper-reader/main.js` / `content/papers/<slug>/annotations.json` 都是 200
- [ ] 浏览器 DevTools → Lighthouse 跑一次，Performance ≥ 90, Accessibility ≥ 95
- [ ] 在 GitHub → Settings → Pages 看 Build & deployment history 是绿色 ✓

---

## Stage 9 / 9.1 变更摘要（部署前回顾）

- **CSS 减肥（Stage 9 A）**：`src/assets/css/layout.css` 471 → 164 行（-65%）。删除 `.bento`（9 子类）、`.hero`（16 子类）、`.cards`、`.section--tight`、`.section__sub` 死类；保留 `.section / .section__head / .section__title / .eyebrow`（实测引用）。
- **microphysics frontmatter 补全（Stage 9 B）**：`src/content/papers/microphysics-zhang/paper.md` 加完整 YAML frontmatter（title / slug / date / type / journal / authors / year / doi / pdf / abstract / status / layout / tags / description）—— 修复列表页「— · 」空白项。HTML 注释移到 YAML 之后（frontmatter 必须文件第 1 行，Stage 8 取舍 3 教训）。
- **about.md GitHub profile 迁移（Stage 9 C）**：第 35 行 `github.com/yihang-lv` → `github.com/oldsixxiaolv`（个人用户名 profile 链接）。保留 portfolio 内嵌的 `yihang-lv/{typhoon-track,era5-pipeline}`（项目独立仓）。
- **首页 bio 加 Manuscript_Lvyh inline link（Stage 9 D）**：bio 加 1 段明示手稿仓存在 + contacts 加第 3 项 Manuscript_Lvyh。
- **邮箱一致性（Stage 9.1）**：全站 3 处 `hi@example.com` 占位 → 真实 `yihang.lv@mail.iap.ac.cn`（index.njk contacts + site.js author.email + site.js social Email）。about.md 第 34 行保留反爬虫格式 `yihang.lv [at] mail.iap.ac.cn`。

---

## Stage 8.3 pathPrefix 变更摘要（部署前回顾）

> 本节是 Stage 8.3 当时的历史记录，**末条已被后续改动推翻**，以正文「项目页路径前缀方案」节为准。

- **eleventy.config.js**：返回 config 对象加 `pathPrefix: '/MeteoHub'`（从 site.url 自动派生）。
- **模板硬编码 → 模板表达式**：base.njk（8 处）/ paper.njk（3 处）/ header.njk（2 处）/ footer.njk（2 处）/ 404.njk（5 处）/ index.njk（4 处），共 24 处 `href="/path"` / `src="/path"` → `{{ '/path' | url }}`。
- ~~**dev server 行为变化**：`http://127.0.0.1:8080/` 自动 302 重定向到 `http://127.0.0.1:8080/MeteoHub/`。~~ **已作废**：现在 `--serve` 会把 pathPrefix 降级为 `/`，dev server 就在根路径，不再重定向。
- **17 处 /MeteoHub/ 引用 + 0 处 /assets/ 残留**（验收 grep 验证；当前 `index.html` 实测 24 处 `/MeteoHub/` 前缀）。
