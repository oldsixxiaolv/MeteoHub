# MeteoHub · 信息架构（Information Architecture）

> **📐 设计规划稿（v1.0 · 2026-09-24）** —— 描述的是**设计意图与目标结构**，不是当前实现快照。已实现的部分见 `README.md` / `HOW_TO_RUN.md`。
>
> **尚未实现**（本文提到但代码里还没有）：`/tags/` 与 `/tags/{tag}/` 标签索引页、`/search/` 站内检索、`/about/cv/` PDF CV、portfolio 的 `cma-meso` 条目、`/blog/2026-08-04-wrf-lessons/`（实际 slug 是 `2026-08-04-wrf-pbl-lessons`）。blog / papers / portfolio 列表页当前用 `size: 100` 一次性渲染，**没有分页**（本文 §4.3 写的「每页 10 篇」未落地）。
>
> 改动实现时，请回来同步这份文档。

> 文档版本：v1.0 · 2026-09-24  
> 输出对象：工程师、实现协作者  
> 设计原则：**短路径、可发现、无冗余**

---

## 一、设计目标与边界

### 1.1 设计目标

1. **5 个一级页面**承担全部主交互：Index / Portfolio / Blog / Papers / About
2. 每个一级页面**最多两级深**（除论文精读页内的「章节跳转」与「批注」伪深度）
3. 全站静态生成，URL 不带后端参数，构建期产出 HTML
4. 中文为主要语言，英文版本留作未来扩展（URL 段用 `/` 不带 `/zh/` 前缀；待国际化时再切）

### 1.2 边界

- 不做：用户登录、评论、订阅流、动态推荐、社交关系
- 不做：管理后台（所有内容通过 PR / Markdown 直接更新）
- 不做：客户端搜索 / PageFind / Algolia（v1.0 做基础内嵌检索，后续迭代再加）

---

## 二、站点地图（Sitemap）

### 2.1 Mermaid 图

```mermaid
graph TD
    A[Index · 首页 /] --> A1[Hero 区：作者位 + 三模块入口]
    A --> A2[精选项目 3 张]
    A --> A3[最近博文 3 张]
    A --> A4[最近精读 2 张]
    A --> A5[页脚：关于 / 友链 / RSS]

    B[Portfolio · 作品集 /portfolio/] --> B1[Projects 列表]
    B1 --> B11[/portfolio/era5-pipeline/]
    B1 --> B12[/portfolio/typhoon-track/]
    B1 --> B13[/portfolio/cma-meso/]

    C[Blog · 博客 /blog/] --> C1[Articles 列表 · 支持 tag 过滤]
    C1 --> C11[/blog/2026-09-12-era5-reanalysis-intro/]
    C1 --> C12[/blog/2026-08-04-wrf-lessons/]
    C1 --> C13[/tags/· 标签索引页]
    C --> C2[关于博客]

    D[Papers · 论文精读 /papers/] --> D1[Papers 列表]
    D1 --> D11[/papers/holton-rollin-1987/]
    D1 --> D12[/papers/microphysics-zhang/]
    D2[Papers 详情 · 双栏] --> D2a[左侧原文 / Markdown]
    D2 --> D2b[右侧批注侧栏]

    E[About · 关于 /about/] --> E1[作者简介]
    E --> E2[研究兴趣 / 技能树]
    E --> E3[时间线 / CV 链接]
    E --> E4[联系方式 / RSS / 友链]

    F[*Common · 全站组件] --> F1[Topbar]
    F --> F2[Footer]
    F --> F3[主题切换]
    F --> F4[站内检索 / search/]
    F --> F5[404 页 /404.html]
    F --> F6[站点地图 /sitemap.xml]
    F --> F7[RSS /feed.xml]
```

### 2.2 树形列表

```
MeteoHub
├── /                           ← 首页 Index
├── /portfolio/                 ← 作品集 Portfolio
│   ├── /portfolio/             ← 列表（卡片网格）
│   └── /portfolio/{slug}/      ← 单项目详情（slugify 项目名）
├── /blog/                      ← 博客 Blog
│   ├── /blog/                  ← 列表（时间倒序）
│   ├── /blog/{yyyy-mm-dd-slug}/  ← 单篇博客
│   ├── /tags/                  ← 全部标签索引
│   └── /tags/{tag}/            ← 单标签筛选
├── /papers/                    ← 论文精读 Papers with annotations
│   ├── /papers/                ← 列表（按阅读完成度排序）
│   └── /papers/{slug}/         ← 单篇精读（左原文 / 右批注）
├── /about/                     ← 关于 About
│   ├── /about/                 ← 单页（可锚点分段）
│   └── /cv/                    ← PDF CV 链接（外链或静态）
├── /search/                    ← 站内检索
├── /404.html                   ← 错误页
├── /feed.xml                   ← RSS 订阅
└── /sitemap.xml                ← 站点地图
```

---

## 三、导航层级（Navigation Hierarchy）

### 3.1 Topbar 一级导航

| 序号 | 标签 | 路径 | 性质 |
|---|---|---|---|
| 1 | 首页 | `/` | 站点门面 |
| 2 | 作品集 | `/portfolio/` | 项目交付物 |
| 3 | 博客 | `/blog/` | 长文思考 |
| 4 | 论文精读 | `/papers/` | 学术核心 |
| 5 | 关于 | `/about/` | 个人介绍 |

> Topbar 永远显示，**最多 5 个入口**，避免拥挤。次要入口（订阅、检索、主题切换）放右侧操作区。

### 3.2 站内交叉入口

| 入口位置 | 跳转到 |
|---|---|
| Hero 三个 CTA | `/portfolio/` `/blog/` `/papers/` |
| 项目详情页底部「相关文章」 | `/blog/?tag={tag}` `/papers/?tag={tag}` |
| 博客详情页底部「研究相关」 | `/portfolio/` 含同 tag 项目 |
| 论文精读详情页右上「下载原文 PDF」 | 外链 PDF |
| 全站页脚 | `/about/` `/feed.xml` `/sitemap.xml` |

### 3.3 面包屑规则

仅在三处使用：

- 项目详情：`首页 / 作品集 / {项目名}`
- 博客详情：`首页 / 博客 / {文章标题}`
- 论文详情：`首页 / 论文精读 / {论文短名}`

> 一级页面（Portfolio / Blog / Papers 列表本身）**不**显示面包屑（与导航重复）。

---

## 四、各页面骨架（Page Skeletons）

### 4.1 `/`（Index）

```
┌──────────────────────────────────────────┐
│ Topbar                                   │
├──────────────────────────────────────────┤
│ Hero（大标题 + 副标题 + 3 个 CTA）       │
│   - "以大气之名"                         │
│   - 副：副标题（中英双语，带温度场情绪） │
│   - CTA: 作品集 / 博客 / 论文精读         │
├──────────────────────────────────────────┤
│ 三个区块（Bento Grid）                   │
│   ① 作品集 Preview（最多 3 张卡片）      │
│   ② 博客 Preview（最多 3 张）            │
│   ③ 论文精读 Preview（最多 2 张）        │
├──────────────────────────────────────────┤
│ Footer                                   │
└──────────────────────────────────────────┘
```

### 4.2 `/portfolio/`

```
H1 作品集
Filter chips：年份 / 类型（科研项目 / 工具 / 比赛）
卡片网格（4 → 3 → 2 → 1 列响应式）
卡片：左封面图 + 右标题 + 简介 + 标签
```

详情页 `/portfolio/{slug}/`：

```
Hero：项目封面 + 标题 + 起止时间 + 角色
摘要：2-3 段
技术栈：徽章组
正文（Markdown，支持图片/视频/公式）
底部：「相关博客 / 相关论文」
```

### 4.3 `/blog/`

```
H1 博客
侧栏（桌面）：标签云 + 归档月份
文章卡片：日期 + 标题 + 摘要 + 阅读时长 + 标签
分页：每页 10 篇，「上一页 / 下一页」
```

详情页 `/blog/{yyyy-mm-dd-slug}/`：

```
H1 文章
元信息：日期 · 阅读时长 · 标签 · 字数
TOC（右侧桌面，顶部移动）
正文（衬线字体 + 段间空行）
底部：「下一篇 / 上一篇」
可选：Mermaid / 数学公式 / 代码高亮
```

### 4.4 `/papers/`

```
H1 论文精读
副：左侧原文 · 右侧批注 · 可联动
列表：论文卡片（左原文摘要，右批注条数）
   - 包含状态徽章：精读中 / 已完成 / 待整理
```

详情页 `/papers/{slug}/`（详见 `papers-interaction.md`）：

```
H1 论文标题（含 DOI/期刊徽章）
元信息：作者 / 期刊 / 年份 / 论文 PDF 链接
布局：
  左列（8/12）：原文 Markdown
  右列（4/12）：批注侧栏
移动端：双栏折叠为顶部 TOC + 批注手风琴
```

### 4.5 `/about/`

```
H1 关于
锚点侧栏（如不需要也可移除）
  - 我是谁
  - 研究兴趣
  - 教育 / 工作经历
  - 技能与工具
  - 联系方式
  - 致谢
```

### 4.6 `/search/`

由 PageFind（v1.0 可暂用客户端 JSON + fuse.js 简易版）提供：
- 单输入框 + 实时结果
- 命中片段高亮
- 支持 `/`、`blog`、`papers`、`portfolio` 过滤

---

## 五、URL / 命名规范

| 类型 | 规则 | 示例 |
|---|---|---|
| 项目 | `/portfolio/{slug}/` | `era5-pipeline` |
| 博客 | `/blog/{yyyy-mm-dd-slug}/` | `2026-09-12-era5-reanalysis-intro` |
| 论文 | `/papers/{slug}/` | `holton-rollin-1987` |
| 标签索引 | `/tags/{tag}/` | `data-assimilation` |
| 静态资源 | `/assets/{path}` | `assets/fonts/Inter-Bold.woff2` |
| 多语言 | 先不做（`/`） | — |

文件名规范：
- 博客 Markdown：`/content/blog/{yyyy-mm-dd-slug}/index.md`，外加 `cover.png`
- 论文 Markdown：`/content/papers/{slug}/paper.md` + `annotations.json` + `cover.png`
- 项目：`/content/portfolio/{slug}/index.md`

---

## 六、内容元数据 Schema

### 6.1 Blog Front Matter

```yaml
---
title: ERA5 再分析数据入门：选区与下载
slug: 2026-09-12-era5-reanalysis-intro
date: 2026-09-12
author: Yihang Lv
tags: [reanalysis, era5, data-assimilation]
cover: cover.png
excerpt: 一份给大气科学初学者的 ERA5 选区与下载实战笔记。
readingTime: 8
status: published
---
```

### 6.2 Portfolio Front Matter

```yaml
---
title: 西北太平洋台风路径快速可视化工具
slug: typhoon-track
type: tool
year: 2025
role: Solo
stack: [Python, Cartopy, xarray]
cover: cover.png
repo: https://github.com/...
demo: https://...
status: shipped
---
```

### 6.3 Paper Front Matter

```yaml
---
title: On the role of moist convection in the QBO
slug: holton-rollin-1987
authors: Holton, J. R., & Rolin, J.
journal: J. Atmos. Sci.
year: 1987
doi: 10.1175/1520-0469(1987)044<XXXX>...
pdf: https://...
tags: [qbo, stratosphere]
readingStatus: finished   # finished | reading | queued
totalAnnotations: 14
---
```

---

## 七、与静态生成的衔接

| 来源 | 工具 | 输出 |
|---|---|---|
| `content/blog/**` | Hugo / Eleventy（v1.0 推荐 Eleventy，零依赖） | `/blog/...` |
| `content/papers/**` | 同上 + `annotations.json` 内联 | `/papers/...` |
| `content/portfolio/**` | 同上 | `/portfolio/...` |
| `content/about.md` | 同上 | `/about/` |
| 标签、归档 | Eleventy collection | `/tags/` |
| RSS、sitemap | Eleventy plugin | `/feed.xml`、`/sitemap.xml` |
| PDF 编译 | Pandoc / Pandomatic（可选） | `/cv.pdf` |

> **建议落地**：v1.0 用 **Eleventy (11ty)** + 一个最小的主页 Layout。零 JS 框架，10 分钟能搭起来。

---

## 八、设计评审清单

- [ ] 五大入口 ≤ 5 个，且语义互斥
- [ ] 二级页面 slug 与论文 / 项目 / 博客一一对应
- [ ] 404 页含 Topbar + 返回首页 CTA
- [ ] 所有页面都有 `<title>` 与 `<meta description>`（SEO）
- [ ] 所有页面都有 OG/Twitter Card（社交分享，可后续）
- [ ] RSS /sitemap 可被爬取
- [ ] 移动端导航用 Drawer，无横滚
- [ ] 「关于」可被一页纸 PDF 下载

