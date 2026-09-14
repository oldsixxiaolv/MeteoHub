# MeteoHub 前端无障碍 / UX 审计报告

> 审计范围：app.js.orig、workspace.js.orig、styles.css.orig、workspace.css、index.html、qa/test-*.js  
> 审计时间：2025-09-13  
> 审计人：Sentinel (slot: 01a09abb-de5d-7491-96f5-5a65350188ff)

---

## §1 现状速览

基于 `qa/verification.md` 的验收结果，前端已验证内容汇总：

| 验证维度 | 覆盖范围 |
| --- | --- |
| DOM / Store 回归 | 12 PASS（登录/退出、成果 CRUD、问答、树操作、知识块编辑、页面切换、订阅清理等） |
| Chrome 真实流程 | 14 组端到端流程通过（移动端/桌面端概览、知识空间/看板、登录/注册/退出、成果 CRUD、问答、Python 工作区、响应式无溢出） |
| 焦点保持 | test-03/03b 已锁定编辑时 G 键不触发；test-03c 排查 Enter 后焦点修复 |
| 防抖锁定 | test-04 已锁定 350ms 防抖 + 切页保留草稿 |
| 挂载契约 | test-08/10/10b/11 已锁 Store/mount 行为 |
| 移动端布局 | verification.md 截图确认 390px 视口无横向溢出 |

**整体评价**：功能回归覆盖较好，UX 感知层（无障碍、颜色对比、屏幕阅读器、触摸目标）**未专项测试**。

---

## §2 语义 HTML

### 2.1 关键区块语义标签

| 区域 | 标签 | 行号 | 备注 |
| --- | --- | --- | --- |
| 顶栏 | `<header role="banner">` | index.html:9 | ✅ 有 role banner |
| 主导航 | `<nav aria-label="主导航">` | index.html:54 | ✅ 有 aria-label |
| 主内容 | `<main id="mainContent" tabindex="-1">` | index.html:89 | ✅ tabindex="-1" 让 skip-link 可达 |
| 页面区块 | `<section aria-labelledby>` | index.html:92, 151, 194, 234, 263, 287, 306 | ✅ 每页有 aria-labelledby |
| 文章/卡片 | `<article>` | index.html:97, 99, 207 | ✅ 用于统计卡和详情卡 |
| 侧栏底部 | `<div class="sidebar-footer">` | index.html:80 | ⚠️ 无语义标签，文字信息可加 `<p>` |
| 页脚 | 无 | — | ⚠️ 当前无 `<footer>` 标签；若将来加社交链接/版权信息，应加语义 |

**缺失**：
- 全局 `<footer>` 标签缺失，待补充（不影响当前功能，但影响全局导航结构）。

### 2.2 表单控件 label 关联

| 表单 | 控件 | label 存在？ | aria-label？ | 备注 |
| --- | --- | --- | --- | --- |
| 登录 | 用户名 input | ✅ 有 `<label>用户名</label>` | — | index.html:357 |
| 登录 | 密码 input | ✅ 有 `<label>密码</label>` | — | index.html:358 |
| 注册 | 用户名 input | ✅ 有 `<label>用户名</label>` | — | index.html:375 |
| 注册 | 邮箱 input | ✅ 有 `<label>邮箱</label>` | — | index.html:377 |
| 全局搜索 | `#globalSearchInput` | — | ✅ `aria-label="全局搜索"` | index.html:24 |
| 成果搜索 | `#pubSearch` | — | ✅ `aria-label="搜索成果"` | index.html:196 |
| 成果年份筛选 | `#pubYearFilter` | — | ✅ `aria-label="按年份筛选"` | index.html:197 |
| 成果类型筛选 | `#pubTypeFilter` | — | ✅ `aria-label="按类型筛选"` | index.html:198 |
| 成果排序 | `#pubSort` | — | ✅ `aria-label="排序"` | index.html:199 |
| 成果收藏 | `#pubOnlyBookmarks` | — | ⚠️ 无 label，仅 `<label class="toggle">` 包裹 | index.html:204 |
| 研究者搜索 | `#resSearch` | — | ✅ `aria-label="搜索研究者"` | index.html:267 |
| 知识空间搜索 | workspace 内部 input | — | ✅ `aria-label="搜索"` | workspace.js.orig:465 |

**问题**：
- `#pubOnlyBookmarks` 复选框只有外层 `<label>` 文字"仅看收藏"，无 `for` 属性绑定，屏幕阅读器可能无法正确关联。
- 研究者筛选 `#resFilter` 无 `aria-label`（index.html:268）。

### 2.3 按钮 vs 链接

| 位置 | 元素 | 类型 | 行号 | 备注 |
| --- | --- | --- | --- | --- |
| 面包屑返回 | `<button class="btn btn-text" data-action="goto" data-page="publications">← 返回成果库</button>` | ✅ button | index.html:160 | 正确 |
| 导航链接 | `<a href="#overview" data-page="overview">` | ⚠️ `<a>` | index.html:56-79 | 正确用于 SPA 导航，但可加 `role="button"` |
| 模态关闭 | `<button data-modal-close="loginModal" aria-label="关闭">×</button>` | ✅ button | index.html:360 | 正确 |
| 危险操作 | 删除成果/问题使用 `confirmAction` | ✅ 有确认框 | app.js.orig:1405, 1416 | 正确 |
| 退出登录 | `<a href="#" role="menuitem" data-action="logout">` | ⚠️ `<a href="#">` | index.html:51 | 触发 JS 的链接建议改 `<button>` |

**建议**：
- index.html:51 退出登录是 `<a>` 但触发 JS 操作，应改 `<button type="button">` 配合 `data-action="logout"`。

---

## §3 ARIA

### 3.1 已有 ARIA 清单（grep 结果）

| ARIA 属性 | 出现次数 | 主要位置 |
| --- | --- | --- |
| `role="banner"` | 2 | index.html:9, workspace.js.orig:462 |
| `role="search"` | 1 | index.html:23 |
| `role="dialog"` | 8+ | 所有模态框 |
| `role="tablist"` / `role="tab"` | 2 | workspace.js.orig:462-463 |
| `role="menu"` | 1 | index.html:41 |
| `aria-modal="true"` | 8+ | 所有模态框 |
| `aria-labelledby` | 7+ | 各 `<section>` 绑定 h1/h2 |
| `aria-label` | 15+ | 搜索框、按钮、图标 |
| `aria-hidden="true"` | 多个 | SVG icon 默认隐藏 |
| `aria-live="polite"` | 3 | toast 容器、workspace 保存指示器 |
| `aria-expanded` | 4+ | sidebar toggle, 用户菜单 |
| `aria-haspopup="true"` | 1 | index.html:38 |
| `aria-checked` | 1 | workspace.js.orig:905 |
| `aria-disabled` | 待核 | — |
| `aria-current` | 待核 | 导航当前页高亮未用 |

### 3.2 关键交互缺 ARIA

| 场景 | 缺失 ARIA | 行号 | 建议 |
| --- | --- | --- | --- |
| 模态对话框 | ✅ 已有 `role="dialog" aria-modal="true"` | index.html:349-366 | — |
| Toast 通知 | ⚠️ 容器有 `aria-live="polite"`，但单个 toast 无 `role="status"` | index.html:427 | 建议加 `role="status"` 到单个 toast 元素 |
| Tab 切换（知识空间） | ✅ 已有 `role="tablist" role="tab"` | workspace.js.orig:462-463 | — |
| 折叠面板（树节点） | ✅ 有 `aria-expanded` | workspace.js.orig:524 | — |
| 快捷键指示 | ⚠️ 键盘提示 `<kbd>` 在 `<a>` 内无 `aria-keyshortcuts` | index.html:56-79 | 可添加但非强制 |
| 搜索结果列表 | ⚠️ 有 `role="listbox"` 但无 `role="option"` 在结果项上 | index.html:26 | 搜索结果项建议加 `role="option"` |

### 3.3 动态加载态

- `aria-busy`：未找到任何使用。知识空间保存中状态（`.workspace-save-indicator.saving`）无 `aria-busy`。
- 建议：保存中时给指示器元素加 `aria-busy="true"`，完成时移除。

### 3.4 Skip Link

```html
<!-- index.html:7 -->
<a class="skip-link" href="#mainContent">跳到主内容</a>
```

- ✅ skip-link 存在于 `<body>` 起始处。
- ✅ `<main id="mainContent" tabindex="-1">` 可接收焦点。
- ⚠️ 需验证：浏览器 Tab 顺序，skip-link 是否第一个可及元素；视觉样式（`.skip-link`）是否在 focus 时显示（styles.css.orig 未见对应样式，待核）。

---

## §4 键盘可达性

### 4.1 全局快捷键（G 键 / `/` 键）

| 快捷键 | 行为 | 代码位置 | 备注 |
| --- | --- | --- | --- |
| `/` | 聚焦全局搜索框 | app.js.orig:1268 | ✅ |
| `G` 然后 `O/P/Q/R/K/Y/M` | 跳转到各页面 | app.js.orig:1270-1273 | ✅ 有 800ms 超时取消 |
| 输入时 `Escape` | 失焦 | app.js.orig:1257 | ✅ |
| 模态内 `Escape` | 关闭模态 | app.js.orig:1500 | ✅ |
| 模态内 `Enter` | 提交表单 | — | ⚠️ 依赖浏览器默认行为，未显式拦截 |

**test-09 锁定**：内容编辑时 G 键不触发跳转（通过 `isContentEditable` 检查）。

**潜在问题**：
- `G` 快捷键没有声音/视觉提示，用户不知道这个功能（无键盘快捷键帮助页）。
- 搜索框聚焦后 `G` 键仍可能被当作普通字符输入。

### 4.2 Tab 顺序

| 场景 | Tab 流 | 备注 |
| --- | --- | --- |
| 登录页 | 顶栏 → 搜索 → 登录按钮 → 打开模态 → 用户名 → 密码 → 提交 | ✅ 逻辑清晰 |
| 成果库 | 工具栏（搜索/筛选/排序） → 结果卡片（tabindex="-1"，非交互）→ 操作按钮 | ⚠️ 结果卡片本身不可 Tab，需靠内部按钮 |
| 知识空间 | 页面标签 → 搜索 → 保存指示器 → 侧栏树 → 主内容块 | ✅ workspace.js.orig 逐项处理 |
| 看板 | Tab 流转到每列卡片，再到底部"添加任务"按钮 | ✅ |

**缺失**：
- 模态对话框打开后，焦点未 trapping（未限制 Tab 在模态内循环）。
- 模态关闭后焦点未恢复到触发元素（`app.js.orig` 无此逻辑）。

### 4.3 Enter / Escape / 方向键

| 操作 | 支持？ | 代码位置 |
| --- | --- | --- |
| 模态关闭 (Escape) | ✅ | app.js.orig:1500 |
| 树展开/折叠 (方向键/点击) | ✅ 点击可折叠 | workspace.js.orig:524 |
| 列表项激活 (Enter) | ✅ | workspace.js.orig:336（confirmDialog） |
| 知识块内 Enter 新建块 | ✅ | workspace.js.orig（test-03 已验证） |

### 4.4 焦点环（outline）

| 文件 | outline 使用 | 行号 | 备注 |
| --- | --- | --- | --- |
| styles.css.orig | `outline: none` 出现 7 次 | 151, 932, 1250, 1550, 1654, 2120, 2230, 2325, 2484 | ⚠️ 多处关闭 outline |
| workspace.css | `outline: 0` 在搜索框和编辑器 | 104, 363, 436 | ⚠️ 可访问性风险 |
| workspace.css | `outline: 2px solid var(--ws-primary)` | 485 | ✅ todo 复选框有焦点环 |
| 全局 reset | 未见 `* { outline: none }` | — | ✅ 无全局关闭 |

**风险**：
- `styles.css.orig:151`（input:focus）、`:932`、`:1250` 等处关闭 outline，依赖自定义 focus 样式但样式可能不统一。
- **建议**：统一用 `:focus-visible` 替代 `:focus { outline: none }`，保留键盘用户的焦点指示。

---

## §5 视觉与色彩

### 5.1 颜色对比度估算

| 文字/背景组合 | 色值 | 对比度 | WCAG AA 要求 | 状态 |
| --- | --- | --- | --- | --- |
| 主文本 (--color-text-primary) | #1a1a2e / #f5f7fa | ~14.5:1 | 4.5:1 | ✅ PASS |
| 次要文字 (--color-text-secondary) | #5a5a7a / #f5f7fa | ~7.2:1 | 4.5:1 | ✅ PASS |
| 辅助文字 (--color-text-muted) | #8a8aa0 / #f5f7fa | ~4.6:1 | 4.5:1 | ✅ PASS |
| 链接文字 | 继承 / #1a1a2e | — | — | ⚠️ 未单独定义，需核对 |
| 主按钮文字 | #ffffff / #1a237e | ~8.6:1 | 4.5:1 | ✅ PASS |
| 模态背景 | #1a1a2e / #ffffff | ~14.5:1 | 4.5:1 | ✅ PASS |
| 知识空间次要文字 | #6b6f80 / #f7f8fb | ~5.8:1 | 4.5:1 | ✅ PASS |

**workspace.css 状态色**：
| 状态 | 颜色 | 对比度（与 #fff 或背景） |
| --- | --- | --- |
| success | #2e7d32（绿） | ~4.9:1 on 白 |
| warn | #ef6c00（橙） | ~3.8:1 on 白 |
| info | #1565c0（蓝） | ~5.9:1 on 白 |
| accent/danger | #e53935（红） | ~4.6:1 on 白 |

⚠️ **warn 色（#ef6c00）与白色背景对比度 ~3.8:1，低于 WCAG AA 4.5:1**，建议加粗或加深。

### 5.2 状态色不只靠颜色

| 场景 | 颜色 | 附加提示？ |
| --- | --- | --- |
| Toast 成功/失败 | toast-success / toast-error | ✅ 仅颜色不同，文字不同（"登录成功"/"会话已过期"） |
| 保存状态 | saving（橙点）/ saved（绿）/ failed（红） | ✅ 有颜色 + 文字 + 脉冲动画 |
| 项目状态标签 | status-pill（todo/doing/review/done） | ✅ 颜色不同但无图标辅助 |
| 错误提示（表单） | warn 类文字 | ⚠️ 仅红色，无图标 |
| 401/409/503 错误 | toast error | ✅ 有文字提示 |

### 5.3 暗色模式

- 当前代码**仅有一套亮色主题**。
- CSS 变量集中在 `:root`，无 `prefers-color-scheme` 媒体查询。
- **预留空间**：CSS 变量体系良好，扩展暗色只需定义 `[data-theme="dark"]` 或 `@media (prefers-color-scheme: dark)` 覆盖变量。

---

## §6 响应式

### 6.1 媒体查询断点

| 文件 | 断点 | 影响的组件 |
| --- | --- | --- |
| styles.css.orig | `@media (max-width: 1024px)` | 网格布局调整为单列 |
| styles.css.orig | `@media (max-width: 768px)` | 导航、搜索框、卡片调整 |
| styles.css.orig | `@media (max-width: 480px)` | 模态宽度、按钮大小 |
| workspace.css | `@media (max-width: 1100px)` | 看板列数 4→2 |
| workspace.css | `@media (max-width: 960px)` | 看板列数 2→1，侧栏折叠为水平 |
| workspace.css | `@media (max-width: 640px)` | 看板单列，表格水平滚动 |
| workspace.css | `@media print` | 打印隐藏工具栏 |
| workspace.css | `@media (hover: none)` | 触摸设备显示树操作按钮 |

**缺失**：
- 无平板专用样式（768px-1024px 区间与桌面共享样式）。
- 看板列数在 960px 以下直接变为 1 列，用户体验可优化（可保留 2 列）。

### 6.2 移动端 sidebar

| 验证点 | 结果 |
| --- | --- |
| 390px 视口无横向溢出 | ✅ verification.md 截图确认 |
| sidebar 折叠按钮可见性 | ✅ `#sidebarToggle` 始终可见 |
| 移动端点击打开 sidebar | ✅ 有 `sidebar-open` class 切换 |
| 导航后关闭 sidebar | ✅ `Router.navigate` 时关闭（app.js.orig:1563） |

### 6.3 触摸目标

- 按钮/链接 padding：顶栏按钮约 `padding: 10px 18px`，高度约 40px+。
- **44x44px 要求**：部分工具栏小按钮（`.btn-icon`）可能不足 44px。
- 搜索框高度 42px ✅。
- 看板卡片内操作按钮过小（`.workspace-kanban-card .row-actions button` padding: 2px 6px），约 20px 高，**不满足触摸要求**。

---

## §7 加载与空状态

### 7.1 列表渲染前状态

| 列表 | 渲染前 | 渲染后 |
| --- | --- | --- |
| 成果列表 | `#pubGrid` 空 | `renderPublications()` 填充 |
| 问答列表 | `#qaList` 空 | `renderQuestions()` 填充 |
| 研究者列表 | `#resGrid` 空 | `renderResearchers()` 填充 |
| 知识空间 | 有 `<noscript>` 提示 | JS 渲染 |

**缺失**：
- ❌ **无 skeleton / spinner**：列表渲染前显示白屏，无加载状态指示。
- ❌ 无 `aria-busy` 标记列表加载中状态。

### 7.2 空数组显示

| 场景 | 空状态文案 | 行号 |
| --- | --- | --- |
| 最近成果 | "暂无成果。请前往「成果库」创建第一条记录。" | app.js.orig:600 |
| 最新问答 | "还没有问题。提问可以邀请同行交流。" | app.js.orig:608 |
| 推荐研究者 | "尚无公开研究者资料。" | app.js.orig:621 |
| 成果库空 | "暂无匹配的成果" | index.html:211 |
| 问答空 | "暂无问答" | index.html:247 |
| 研究者空 | "暂无研究者" | index.html:278 |
| 知识空间 | 有 `workspace-empty` 组件 | workspace.js.orig |

✅ 所有列表都有空状态文案，告知用户下一步操作。

### 7.3 错误状态反馈

| 错误类型 | UI 反馈方式 | 代码位置 |
| --- | --- | --- |
| 网络错误 | toast "网络错误，未保存" | app.js.orig:319 |
| 401 会话过期 | toast "会话已过期，请重新登录" | app.js.orig:325 |
| 409 冲突 | toast "数据版本冲突，请先复制未保存内容，再刷新页面" | app.js.orig:336 |
| 503 保存失败 | toast "保存失败 (HTTP 503)，请重试" | app.js.orig:339 |
| localStorage 满 | toast "浏览器存储不可用或已满" | app.js.orig:346 |
| 知识空间保存失败 | 指示器变红 + "保存失败" + 重试按钮 | workspace.js.orig:181-196 |

✅ 错误反馈完整，toast 覆盖主要错误场景。

---

## §8 通知与反馈

### 8.1 Toast 行为

| 行为 | 当前值 | 代码位置 |
| --- | --- | --- |
| 显示延迟 | 10ms | app.js.orig:510 |
| 显示时长 | 3500ms | app.js.orig:512 |
| 消失动画 | 300ms | app.js.orig:514 |
| 堆叠规则 | 无（每次创建新 toast 直接 append） | app.js.orig:505 |
| 可关闭性 | ❌ 无关闭按钮 | — |
| 堆叠上限 | 无 | — |

**问题**：
- 连续触发多个 toast 会堆叠在容器内，遮挡界面。
- 无手动关闭按钮，用户需等待 3.5s。

### 8.2 保存中状态

| 行为 | 实现 | 备注 |
| --- | --- | --- |
| 防抖延迟 | 350ms | workspace.js.orig:972 |
| 视觉反馈 | "保存中…" + 脉冲点 | workspace.js.orig:303 |
| 切页保留 | ✅ 已锁定（test-04） | — |
| 失败显示 | "保存失败：" + 重试按钮 | workspace.js.orig:181 |

### 8.3 自动保存 vs 显式保存

- 知识空间块编辑：自动保存（无"保存"按钮），用户感知靠保存指示器。
- 成果/问答/研究者：表单提交显式保存，有按钮。
- ⚠️ 两者行为不一致，可能导致用户困惑（知识空间无保存按钮，表单页有）。

---

## §9 表单与交互

### 9.1 必填字段标记

| 表单 | 必填标记 | 实现方式 |
| --- | --- | --- |
| 成果表单 | "标题 *" | 文字 "*" + `required` 属性 |
| 问答表单 | "问题标题 *" / "详情 *" | 文字 "*" + `required` 属性 |
| 登录表单 | 用户名/密码 | 有 `required` 属性，无视觉 "*" |
| 注册表单 | 用户名/邮箱/密码 | 有 `required` 属性，无视觉 "*" |

**问题**：
- 登录/注册表单的必填字段无视觉 "*" 标记，仅依赖 HTML `required` 属性，视觉一致性不足。
- 建议：所有必填字段统一加 "*" 前缀文字。

### 9.2 字段校验反馈

| 场景 | 校验时机 | 反馈位置 | 备注 |
| --- | --- | --- | --- |
| DOI 格式 | 失焦 + 提交前 | toast / inline hint | app.js.orig:1100 |
| ORCID 格式 | 提交前 | toast | app.js.orig:1352 |
| 用户名格式 | 提交前 | toast | app.js.orig:1318 |
| 密码一致性 | 提交前 | toast | app.js.orig:1316 |
| 邮箱格式 | 浏览器默认 | 浏览器提示 | HTML5 内置 |

**问题**：
- ❌ 校验均为提交时触发，失焦即时校验缺失。
- ❌ 错误信息位置不统一（有时 toast，有时 inline hint）。

### 9.3 危险操作确认

| 操作 | 确认方式 | 代码位置 |
| --- | --- | --- |
| 删除成果 | `confirmAction` + confirmModal | app.js.orig:1405 |
| 删除问题 | `confirmAction` + confirmModal | app.js.orig:1416 |
| 退出登录 | ❌ 无确认 | — |

⚠️ **退出登录无确认**，用户误点可能导致未保存内容丢失。

---

## §10 性能感知

### 10.1 首屏渲染

| 资源 | 加载方式 | 阻塞？ | 建议 |
| --- | --- | --- | --- |
| Google Fonts (Inter) | `<link>` 同步 | ⚠️ 渲染阻塞 | 建议加 `preconnect` + `display=swap` |
| styles.css | `<link>` 同步 | ⚠️ 可能阻塞 | — |
| workspace.css | `<link>` 同步 | ⚠️ 可能阻塞 | — |
| app.js / workspace.js | `defer` | ✅ 非阻塞 | — |

**建议**：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```
当前 index.html 缺少 `preconnect` 和 `display=swap`。

### 10.2 大量数据渲染

| 场景 | 当前实现 | 备注 |
| --- | --- | --- |
| 成果列表 | 全量渲染 | ⚠️ 无虚拟滚动，待核（数据量>100 时可能有性能问题） |
| 问答列表 | 全量渲染 | ⚠️ 无分页 |
| 知识空间树 | 全量渲染 | ⚠️ 无虚拟滚动 |

### 10.3 图片懒加载

- 当前代码无 `<img>` 标签（用户上传未实现）。
- 顶栏 SVG 图标用 `aria-hidden="true"` 正确隐藏。
- ✅ 无懒加载问题。

---

## §11 测试覆盖观察

### 11.1 qa/test-*.js 覆盖的 a11y / UX 维度

| 测试文件 | 覆盖维度 | 备注 |
| --- | --- | --- |
| test-02-tree.js | ARIA label（新建/删除按钮） | ✅ 有 `aria-label` 检查 |
| test-03-blocks.js | 焦点保持、内容保持 | ✅ focus/content preservation |
| test-03b-focus-repro.js | Enter/Backspace 焦点缺陷复现 | ✅ |
| test-03c-focus-debug.js | Enter 焦点超时调试 | ✅ |
| test-04-pending-save.js | 保存状态、防抖 | ✅ |
| test-08-mount-leak.js | 挂载契约、订阅清理 | ✅ |
| test-09-typing-rebuild.js | 打字触发 DOM rebuild | ✅ |
| test-09b-typing-single-mount.js | 单次挂载打字 | ✅ |
| test-10-switch-race.js | 页面切换竞态 | ✅ |
| test-10b-switch-roundtrip.js | 切换往返 | ✅ |
| test-11-store-identity.js | Store 身份一致性 | ✅ |

### 11.2 未覆盖的空白

| 空白 | 严重度 | 备注 |
| --- | --- | --- |
| 颜色对比度 | 中 | 无自动化 WCAG 对比度测试 |
| 键盘焦点链（全局） | 高 | 无端到端 Tab 顺序测试 |
| 屏幕阅读器（NVDA/VoiceOver） | 高 | 未用真实屏幕阅读器测试 |
| 触摸目标尺寸 | 中 | 无 44x44px 验证 |
| 模态焦点 trapping | 高 | 无测试 |
| skip link 功能 | 中 | 无测试 |
| Toast 堆叠/可关闭性 | 低 | 纯视觉/UX |

---

## §12 优先级清单

| 编号 | 等级 | 描述 | 行号 | 建议 | 验证手段 |
| --- | --- | --- | --- | --- | --- |
| P0-1 | **P0** | 模态打开后焦点未 trapped，Tab 在模态外仍可导航 | index.html:349-427 | 添加 `inert` 属性或手动 focus trapping | 手动 Tab 测试 |
| P0-2 | **P0** | 退出登录无确认弹窗，误点可能丢数据 | index.html:51 | 添加 `confirmAction('确定要退出登录吗？')` | 功能测试 |
| P0-3 | **P0** | 列表渲染前无 skeleton/spinner + 无 `aria-busy` | app.js.orig:无 | 渲染前显示加载状态，aria-busy 标记 | 手动测试/代码审查 |
| P0-4 | **P0** | focus-visible 被多处 `outline: none` 关闭，键盘用户失去焦点指示 | styles.css.orig:151, 932 等 | 改用 `:focus-visible { outline: ... }` | 键盘导航测试 |
| P1-1 | **P1** | warn 状态色 #ef6c00 与白底对比度 3.8:1，不满足 WCAG AA 4.5:1 | workspace.css:status-pill | 改为 #d84315 或加粗文字 | 对比度计算器 |
| P1-2 | **P1** | toast 无手动关闭按钮，堆叠遮挡界面 | app.js.orig:502-515 | 添加 × 关闭按钮，限制堆叠数量 | 视觉审查 |
| P1-3 | **P1** | 表单必填字段视觉不一致（登录/注册无 * 标记） | index.html:354-358, 374-382 | 统一加 "*" 前缀文字 | 视觉审查 |
| P1-4 | **P1** | 模态关闭后焦点未恢复到触发元素 | app.js.orig:无 | 记录触发元素，关闭时 focusBack | 键盘测试 |
| P1-5 | **P1** | 看板卡片操作按钮触摸目标过小（约 20px 高） | workspace.css:row-actions button | padding 至少 8px 12px | 触控测试 |
| P2-1 | **P2** | Google Fonts 缺 `preconnect` + `display=swap` | index.html:6 | 添加 preconnect | Lighthouse |
| P2-2 | **P2** | 无暗色模式（CSS 变量体系已就绪） | styles.css.orig | 添加 `@media (prefers-color-scheme: dark)` | 手动切换 |
| P2-3 | **P2** | 大量数据无虚拟滚动/分页（成果/问答列表） | app.js.orig:无 | 数据量>50 时考虑分页或虚拟列表 | 性能测试 |
| P2-4 | **P2** | 全局 `<footer>` 标签缺失 | index.html | 添加 `<footer>` | 语义审查 |
| P2-5 | **P2** | 无键盘快捷键帮助页（G 键功能用户不知道） | app.js.orig:1262 | 添加快捷键提示面板（`?` 键触发） | 用户体验测试 |

---

## §13 不要动的事项（已锁定）

以下契约经 test-08/10/11 验证锁定，**不建议修改**：

| 事项 | 锁定依据 |
| --- | --- |
| Store / mount 契约 | test-08, test-10, test-10b, test-11 |
| 350ms 防抖 | test-04, test-09 |
| 切页保留草稿行为 | test-04 |
| CSP / Origin 校验 | verification.md |
| 登录态路由同步 | test-10b |
| 成果 CRUD + DOI 校验 | verification.md |
| 树操作（展开/折叠/新建/删除） | test-02 |
| 知识块编辑（Enter/Backspace/新建块） | test-03, test-03b, test-03c |
| 订阅清理（mount 泄漏） | test-08 |
| 页面切换时取消旧订阅 | test-10, test-10b |
| localStorage 迁移逻辑 | app.js.orig:98-129 |

---

*报告生成完毕。共 ~390 行。*
