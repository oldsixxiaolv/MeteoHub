# MeteoHub v2.0.0 全面优化 · 架构扫描报告

> 由 Hermes (lead) 亲自完成扫描，原定 Atlas (Claude) 已因 user_stop 中断后被系统移除，本报告接续原 T1 任务。
> 报告只扫描不改代码；每条结论带文件:行号定位。

---

## §1 项目当前状态速览

**MeteoHub v2.0.0** = Flask + SQLite + 原生 JS 单用户学术工作台。代码体量：server.py 866 行、index.html 640 行、**app.js 1585 行 / workspace.js 1525 行 / styles.css 2627 行**——这些都是**人写的源码**（有 IIFE、'use strict'、中文注释、57 个函数声明）。

> **事实更正（依据 DOCS_AUDIT.md §2.5 实测）**：我此前误判 `app.js.orig` 是"min 前的源码"——实测 `app.js` == `app.js.orig` == `backups/app.js.bak.20260913_051509`（byte-equal 82755 字节）。当前工作区从一开始就是源码状态，并不存在"min 覆盖源码"问题。`.orig` 只是另一个备份名而已，不是 minify 前的真正可读源。

**已验证事实**（依据 qa/verification.md + T6 RERUN_LOG 复跑一致）：67 pytest + 12 DOM/Store + 14 真实 Chrome 流程全过；JS 语法 / shell 语法 / 启动实测 / 409 / 401 / 账户切换 / 配额失败路径全部覆盖。代码质量已经在收尾阶段做到相当专业 —— OCC + WAL、timing-safe 登录、CSP、CSRF Origin 校验、深度校验、XSS escape、XSS 测试、cwd-aware stop.sh、secret-key 隔离 fixture 都已经到位。

**git 现状**：11 modified + 18 untracked 未提交。说明上一轮"全面优化"实际做了：terser/csso 试跑（产物保留在 `backups/*.min.YYYYMMDD_HHMMSS`，与现源码不同）+ 一套 QA 体系搭建 + build/backup-restore 脚本 + 8 个 shell 脚本归一化。**未真正改业务逻辑**。

**真正的隐患（DOCS_AUDIT.md §11 P0 列出，T6 复跑确认不影响功能，但仍是工程债务）**：
1. **`.gitignore` 严重不足**（314 字节，但缺 `backups/` `node_modules/` `dist/` `qa/node_modules/` `data/*.db*` `data/secret.key` `server.pid` `server.log` `__pycache__/` `.venv/` `.DS_Store` 等 10+ 项关键忽略规则）→ 误提交风险高，密钥一旦进 git 就泄露。
2. **`package.json:10 test:frontend: "node qa/run-all.sh"`** → qa/run-all.sh 是 bash 脚本，node 跑会失败（实测：node 调用 .sh 时如不带 shebang 直接退出）。这意味着 `npm run test:frontend` 当前是**坏命令**。
3. **`requirements.txt` 缺 werkzeug 和 itsdangerous**（server.py:67 真的 import）→ 全新克隆执行 `pip install -r requirements.txt` 会 ImportError。
4. **`README.md` API 表格缺 4 个端点**：`/api/active-count`、`/api/track-active`、`/api/code-runs`、`/api/admin/stats`、`/api/admin/clear-history`、`/api/code-history`、`/api/run-code` 都没文档化（实际 server.py 都有，但 README 只列了 6 个）。
5. **`backup-restore.sh restore` 误导**：会把当前 `app.js` 备份为 `.min.YYYYMMDD_HHMMSS`，然后把 `app.js.orig` 拷成 `app.js` —— 但 `.orig` 和当前 `app.js` byte-equal，结果什么都没变。脚本文案说"已恢复原始文件"是误导。

---

## §2 优化机会清单

> 编号 | 类别 | 文件:行号 | 当前实现简述 | 建议改进 | 预期收益 | 风险/回退点 | 优先级

### A. 工程化基线（DOCS_AUDIT.md §11 P0/P1 提炼）

| # | 类别 | 位置 | 当前 | 建议 | 收益 | 风险/回退 | P |
|---|---|---|---|---|---|---|---|
| A1 | .gitignore 严重不足 | `.gitignore` 314 字节 | 缺 `backups/` `node_modules/` `dist/` `qa/node_modules/` `data/*.db*` `data/secret.key` `server.pid` `server.log` `__pycache__/` `.pytest_cache/` `.venv/` `.DS_Store` 等 10+ 项 | 一次性补齐；不再 git rm 已 untracked 的目录 | 防止密钥 + 用户数据 + 依赖目录被误提交 | 无（.gitignore 不影响功能） | **P0** |
| A2 | 坏 npm 脚本 | `package.json:10 test:frontend: "node qa/run-all.sh"` | 用 node 跑 .sh 必失败 | 改成 `"bash qa/run-all.sh"`（`lint` 同理如未来要加） | `npm run test:frontend` 真正可用 | 无 | **P0** |
| A3 | requirements.txt 缺依赖 | `requirements.txt` 34 字节 | 缺 `werkzeug`、`itsdangerous`（server.py:67 真 import） | 补全；可考虑加版本 pin | 全新克隆执行 pip install -r 不再 ImportError | 无 | **P0** |
| A4 | backup-restore.sh 误导 | `backup-restore.sh restore` 分支 | 当前会把 app.js 备份为 `.min.YYYYMMDD_HHMMSS`，再把 `.orig` 拷成 app.js——但 `.orig` 与当前 app.js byte-equal，结果什么都不变 | 改成"如果 .min 版本存在则用它恢复；否则说明无可恢复历史"；脚本文案不再说"已恢复原始文件" | 脚本语义诚实 | 无 | **P0** |
| A5 | README API 表格不全 | `README.md` API 表格 | 缺 `/api/active-count`、`/api/track-active`、`/api/code-runs`、`/api/run-code`（410）、`/api/admin/stats`、`/api/admin/clear-history`、`/api/code-history`（404） | 补全表格，每个标注状态码语义 | 文档与代码一致；外部使用者不再被误导 | 无 | **P0** |
| A6 | build-optimized.sh 备份路径引用 | `build-optimized.sh:36-38` | 末尾 echo 引用 `backups/app.js.bak.*` 统计"压缩前大小"，但备份是 .bak.YYYYMMDD，**不是 min 前的快照** | 改为引用 `dist/app.js` 上一版本或干脆删除这段统计 | 脚本语义诚实 | 无 | P1 |
| A7 | build-optimized.sh / backup-restore.sh 缺 pipefail | `build-optimized.sh` 头部 / `backup-restore.sh` 头部 | 其它 shell 都有 `set -euo pipefail`，这两个没 | 统一加 | 防御级联失败 | 无 | P1 |
| A8 | .orig 文件其实是备份副本 | `app.js.orig` `workspace.js.orig` `styles.css.orig` | 与 `app.js` byte-equal，没特殊含义 | 考虑把 .orig 加入 .gitignore（与 backups 一起），删除这三个文件以减少混乱 | 仓库更干净 | 删除前先确认 .orig 真的没特殊含义（DOCS_AUDIT §2.5 已确认） | P2 |
| A9 | qa/run-all.sh FAIL=0 不打印 stdout | `qa/run-all.sh` | 失败时才 echo output，成功只打印 PASS | 加 stdout 摘要或 verbose 开关；或保留现状仅文档化 | 调试更友好 | 无 | P2 |

### B. 前端可维护性 / 可读性（在 .orig 恢复后才有意义）

| # | 类别 | 位置 | 当前 | 建议 | 收益 | 风险/回退 | P |
|---|---|---|---|---|---|---|---|
| B1 | 模块拆分 | `app.js.orig` 起头是 `(function () { ... 'use strict'; })()` IIFE（一个文件 ~1500 行） | 全部前端逻辑单文件 | 暂不动（IIFE 是性能最优且与现有 webpack-less 工作流匹配）；在文件顶部加区块注释 `/* ==== 区块名 ==== */` 方便导航 | 不改行为，仅改善导航 | 零 | P2 |
| B2 | 模块拆分 | `workspace.js.orig` 同上 ~1200 行 IIFE | 知识空间 + 项目看板塞一文件 | 同上，加区块注释；不拆文件（避免破坏 `window.MeteoWorkspace.mount(root)` 的单 mount 契约，verification.md 已锁定） | 改善导航 | 零 | P2 |
| B3 | 事件绑定 | `workspace.js.orig` 中 `debounce(fn, 350)` + `addEventListener` 频繁出现（test-04 锁定 350ms 防抖契约） | 知识块自动保存 350ms 防抖 | 加 unit test 覆盖：连击输入、防抖期内切页、Enter / Backspace 焦点迁移；qa/test-04 已覆盖部分 | 防止未来回归 | 新增 test 不要破坏既有 12 PASS | P1 |
| B4 | HTML 体积 | `index.html` 640 行（含 SVG inline + 大量静态结构） | 顶栏 SVG、所有视图容器、全部 `<button>` 都 inline | 顶栏重复 SVG（sidebar toggle / search / nav）抽到 `<defs>` + `<use>`；不是优化重点，可选 | 体积小降 | 视觉一致性要先校验 | P3 |

### C. 后端工程（在已验证的 server.py 上做轻量增强，不改契约）

| # | 类别 | 位置 | 当前 | 建议 | 收益 | 风险/回退 | P |
|---|---|---|---|---|---|---|---|
| C1 | 限流 | `server.py` 全文 | `/api/auth/login`、register、state PUT 都没有 rate limit；只靠 timing-safe 防爆破 | 给 `/api/auth/login` + `register` 加内存滑动窗口限流（5 次/分钟/IP），失败计数 30 分钟封禁；IP 取 `request.remote_addr` 或 `X-Forwarded-For`（仅当配置 `TRUST_PROXY=1`） | 抗暴力破解；纯内存，无新依赖 | Flask dev server 单进程，扩到 gunicorn 时需换 limiter；qa/test_race_and_security.py 已覆盖并发，重测 | P1 |
| C2 | 错误观测 | `server.py:702-720` 附近 errorhandler | 5xx 返回 `_bad("服务器内部错误", 500)`，但 `stderr` 是否实际有日志未确认（待核） | 显式 `app.logger.exception("...")` 输出栈到 stderr；README.md 描述日志位置（已提到 `server.log`，但 Flask 默认 stderr，需对齐） | 调试更快 | 日志要确认不含密码 / session token | P1 |
| C3 | SQL 索引 | `server.py:172 SCHEMA` | `state(user_id PRIMARY KEY, ...)` 已有主键索引；`users(username UNIQUE)` 已有；`code_runs(id PK)` 但**无 `at` 索引**，`COUNT(*)` 全表扫 | code_runs 增长后 `COUNT(*)` 变慢；加 `CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)`；迁移脚本友好（IF NOT EXISTS） | 查询稳定；表大时收益明显 | 当前表小影响零，但加索引零成本 | P2 |
| C4 | 输入校验 | `server.py:_bounded_str` | 已校验 string 长度 | 验证 `username` 不含 control chars（当前只挡非 ASCII）；增加 control-char 拒绝 | 减少显示/导出异常 | 加严后旧账号仍能登录 | P3 |
| C5 | session 配置 | `server.py:_set_session_cookie` `secure=False` | 当前 dev 默认 false；README 已写"生产部署另行配置" | 加 `if not app.debug: secure=True` 自动切换；显式环境变量 `SESSION_COOKIE_SECURE=1` 可强制 | 上 HTTPS 不需要改代码 | 改了之后 HTTP localhost 测试可能受影响 → 加 `if request.is_secure or app.debug` 判定 | P3 |

### D. 前端可访问性 / UX

| # | 类别 | 位置 | 当前 | 建议 | 收益 | 风险/回退 | P |
|---|---|---|---|---|---|---|---|
| D1 | ARIA | `index.html` 顶栏 + workspace | 大部分按钮已 `aria-label`；skip-link 存在；`<header role="banner">` 已有 | 通读一遍验证：表单缺 `<label>` 关联的补；`[aria-busy]` 在加载态；用 qa-harness 跑一次 axe-core | a11y 分数提升 | 新增 ARIA 不要破坏既有 tab order | P1 |
| D2 | 键盘 | `app.js.orig` 提及 "内容编辑不触发全局 G 键或 `/` 快捷键"（verification.md 已锁定） | 已通过 test | 写一个键盘契约测试（test-09 系列已部分覆盖）；形成 documentation | 防回归 | 零 | P2 |
| D3 | 移动端 | `styles.css.orig @media (max-width: 640px)` | 已有移动端样式；verification.md 桌面 1440px / 移动 390px 都截屏验证 | 在 768px (平板) 加断点；现有 `app.js.orig` 没有 touch-specific 事件，结构 OK | 平板体验 | 不要破坏移动端已通过的截图回归 | P2 |
| D4 | 空状态 | 多处列表（成果/问答/研究者/项目） | 默认示例数据 + 真实空状态待核 | 检查所有 list 渲染分支：空数组时显示友好提示而非空白页 | 体验 | 零 | P2 |
| D5 | 加载态 | workspace.js 切页 | verification.md 已验 save toast + pending save 行为 | 给 mount/render 加 `[aria-busy="true"]` 标签 | a11y | 零 | P3 |

### E. 依赖 / 构建 / 文档

| # | 类别 | 位置 | 当前 | 建议 | 收益 | 风险/回退 | P |
|---|---|---|---|---|---|---|---|
| E1 | README | `README.md` | 已写得很完整 | 加 "构建产物 vs 源码" 一节，明确 `app.js` 是 minified，`app.js.orig` 是源码 | 维护者不再困惑 | 零 | **P0**（与 A1 配套） |
| E2 | README | `HOW_TO_RUN.md` 152 行 diff | 已经详细（环境变量 / 启动 / 停止） | 加一句 "本仓库 `app.js` 是 minified 产物；如需修改前端，请编辑 `app.js.orig` 后运行 `npm run restore` 切回源码" | 防踩坑 | 零 | **P0** |
| E3 | .gitignore | `.gitignore`（见 ls -la 输出） | 14 字节，已忽略部分 | 加 `backups/`、`server.pid`、`data/*.db*`、`data/secret.key`、`__pycache__/`、`.venv/`、`node_modules/`、`qa/node_modules/` | 防误提交 | 已有 untracked 中 `node_modules/` 要先决定是否提交（应忽略） | **P0** |
| E4 | tests 覆盖率 | `tests/` 6 个 test_*.py | test_app_isolation / auth / race_and_security / size_and_secret / state / static_and_legacy / stop_script | 加 `tests/test_rate_limit.py` 覆盖 C1；如果引入限流 | 与 C1 配套 | 零 | P1 |
| E5 | requirements | `requirements.txt` 34 字节（仅 flask + 依赖名） | 待核 | 列出实际 pins（`flask==3.x`、`werkzeug==3.x`、`itsdangerous==2.x`） | 可重现构建 | 加 pin 后下次升级要主动改 | P3 |

### F. 不要动的事项（已被验收锁定）

> 动以下任何一项必须先复制当前 qa/verification.md 的成功基线，并新增回归测试。

1. **API 契约**：`/api/auth/*`、`/api/state` GET/PUT（含 401 / 409 / revision 自增）、`/api/active-count`、`/api/code-runs`、`/api/track-active` —— README.md 表格 + verification.md 已锁。
2. **`/api/run-code` 必须保持 410 Gone**（verification.md "原 Python→JS 动态执行器已移除"）；admin 端点保持 404。
3. **`window.MeteoHubStore` 的单一事实源契约**：`get()` / `update(mutator)` / 账户 epoch 队列 / 迟到响应不覆盖新账户 revision —— test-10 / test-11 已锁。
4. **`window.MeteoWorkspace.mount(root)` 单 mount 契约**：同一 root 不允许多 mount（test-08 mount-leak 已锁）。
5. **知识块自动保存 350ms 防抖** + 切页前未保存输入保留（test-04 已锁）。
6. **CSP / Origin 校验 / X-Frame-Options**（server.py:330 附近）—— 不允许弱化。
7. **stop.sh 的 cwd + cmdline 双重校验**（已被 test_stop_script.py 锁）—— 不允许简化。
8. **secret.key 隔离**（tests/conftest.py:14-20）—— 不允许在测试里覆盖真实密钥。
9. **数据迁移**：旧 `meteohub_users` / `meteohub_articles` / `meteohub_friends` 的合入逻辑（在 app.js.orig 内）只迁移一次，保留原键不删 —— 不允许改。

---

## §3 推荐实施顺序

**Phase 1 — 工程债务清理（基于 DOCS_AUDIT.md P0，独立可做）**
- T-A1：补全 `.gitignore`（10+ 项忽略规则） + 同时 `git rm --cached -r backups/ node_modules/ qa/node_modules/ data/` 把当前已 untracked 但应忽略的目录解除跟踪
- T-A2：修 `package.json:10 test:frontend` 改 `bash qa/run-all.sh`
- T-A3：补 `requirements.txt` 加 `werkzeug` `itsdangerous`
- T-A4：修 `backup-restore.sh restore` 的误导文案 + 逻辑
- T-A5：补全 `README.md` API 表格
- 验证：`pytest tests/ -q` 仍 67 passed（不改 server.py 必过）；`bash qa/run-all.sh` 仍 12 PASS；`node --check app.js && node --check workspace.js` 仍 OK；T6 RERUN_LOG.md 已确认这些基线
- 风险：0——全是文档、配置、忽略规则；不动业务代码；不破坏任何 verification.md 已通过断言

**Phase 2 — 后端轻量增强（C1-C5，需 Bastion 出具 SECURITY_AUDIT_BACKEND.md 后合并）**
- 等 T3 完成
- 候选：限流 + 错误日志 + SQL 索引（`CREATE INDEX IF NOT EXISTS`）+ session cookie secure 切换
- 验证：`pytest tests/ -q` 仍 67 passed（新增 test_rate_limit.py 后总数增加）；qa 不变

**Phase 3 — 前端 a11y / UX（D1-D5，需 Sentinel 出具 UX_AUDIT_FRONTEND.md 后合并）**
- 等 T4 完成
- 候选：ARIA 通审 / 键盘契约测试 / 平板断点 / 空状态
- 验证：`bash qa/run-all.sh` 仍 12 PASS + Chrome 14 流程仍全过

**Phase 4 — 收尾**
- 重跑 `pytest + qa/run-all.sh + node --check` 三件套
- 更新 `qa/verification.md`（追加行 + 新增 evidence）
- 写 `OPTIMIZATION_CHANGELOG.md` 给用户

**Phase 5 — 依赖扫描整合**
- 等 T7 出具 DEPENDENCY_AUDIT.md；如有 flask/werkzeug CVE 则升级 + 重测

---

## §4 明确不要动的（与 §2.F 对应，简版）

- API 路由 / 状态码 / session 行为
- Store / mount 契约
- 防抖时序（350ms）
- CSP / Origin / X-Frame-Options
- stop.sh 的多步 PID 校验
- 旧数据迁移只跑一次的逻辑
- qa/verification.md 已通过的所有断言（"不要回退验收"）

---

## 附：建议的人天（仅供参考）

| 阶段 | 内容 | 人天估 |
|---|---|---|
| Phase 1 | A1 + E1/E2/E3 + 验证 | 0.5 d |
| Phase 2 | C1-C5 + test_rate_limit | 1 d |
| Phase 3 | D1-D4 | 1 d |
| Phase 4 | 重跑 + 更新文档 | 0.3 d |
| **合计** | | **~3 d** |

未提交文件清理（A3）和 B1/B2 区块注释可塞进 Phase 3 顺手做。

---

*报告路径：/Volumes/Kingston/Mac/MeteoHub/OPTIMIZATION_AUDIT.md*
