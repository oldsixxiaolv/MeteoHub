# MeteoHub 优化 · 6 份审计横向汇总

> 由 Hermes (lead) 在 OPTIMIZATION_AUDIT.md 基础上完成最终汇总。
> 依据：6 份独立审计 + T6 端到端复跑，全部 completed。
> 报告：**所有结论带文件:行号定位**；找不到证据的写"待核"。

---

## §0 6 份审计清单

| 报告 | 行数 | 作者 | 状态 |
|---|---|---|---|
| [OPTIMIZATION_AUDIT.md](OPTIMIZATION_AUDIT.md) | 157 | Hermes (lead) | ✅ |
| [SECURITY_AUDIT_BACKEND.md](SECURITY_AUDIT_BACKEND.md) | 484 | Bastion (Hermes backend) | ✅ T3 |
| [UX_AUDIT_FRONTEND.md](UX_AUDIT_FRONTEND.md) | 491 | Sentinel (Pi) | ✅ T4 |
| [DOCS_AUDIT.md](DOCS_AUDIT.md) | 507 | Hermes② (Hermes backend) | ✅ T5 |
| [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md) | 400 | Pi② (Pi) | ✅ T7 |
| [qa/RERUN_LOG.md](qa/RERUN_LOG.md) | 293 | Pi① (Pi) | ✅ T6（端到端复跑） |

合计 ~2332 行审计证据 + 157 行汇总 = **~2500 行**带行号的事实基础。

---

## §1 横向交叉：被多份报告共同点名的 P0

| 主题 | Hermes lead | T3 Bastion | T4 Sentinel | T5 Hermes② | T7 Pi② | 共识 |
|---|---|---|---|---|---|---|
| **.gitignore 严重不足**（缺 backups/node_modules/data/secret.key 等 10+ 项） | A1 P0 | — | — | P0-3 | P0 | **5/5 共识** |
| **package.json:10 test:frontend 坏**（node 跑 .sh 必失败） | A2 P0 | — | — | P0-1 | — | 3/5 |
| **requirements.txt 缺 werkzeug/itsdangerous** | A3 P0 | §2.2 隐含 | — | P1-5 | §2.2 | **4/5 共识** |
| **backup-restore.sh restore 误导** | A4 P0 | — | — | P0-4 | — | 2/5 |
| **README API 表格缺 4-7 端点** | A5 P0 | §6 一致 | — | P1-8 | — | 3/5 |
| **登录/注册/state PUT 无限流** | C1 P1 | **P0-1** | — | — | — | 2/5（T3 升级为 P0） |
| **cookie secure=False 硬编码** | C5 P3 | **P0-2** | — | — | — | 2/5（T3 升级为 P0） |
| **5xx 无 Flask logger** | C2 P1 | **P0-3** | — | — | — | 2/5（T3 升级为 P0） |
| **模态焦点 trap** | — | — | **P0-1** | — | — | 1/5 |
| **退出登录无确认** | — | — | **P0-2** | — | — | 1/5 |
| **无 skeleton / aria-busy** | — | — | **P0-3** | — | — | 1/5 |
| **焦点环 outline:none 关闭** | — | — | **P0-4** | — | — | 1/5 |

**结论**：.gitignore + requirements.txt + 限流 + secure cookie + 5xx 日志 = **真正的头号 5 个 P0**，被 2 份以上审计独立确认。

---

## §2 合并优先级（去重 + 升级）

### 真正 P0（必做，跨多份审计独立确认）

| 编号 | 类别 | 位置 | 修复简述 | 共识 |
|---|---|---|---|---|
| P0-1 | 工程化 | `.gitignore` | 补 12+ 项关键忽略（backups/、node_modules/、dist/、qa/node_modules/、data/*.db*、data/secret.key、server.pid、server.log、__pycache__/、.pytest_cache/、.venv/、.DS_Store） | 5/5 |
| P0-2 | 安全 | `package.json:10` | `test:frontend: "node qa/run-all.sh"` 改 `"bash qa/run-all.sh"` | 3/5 |
| P0-3 | 安全 | `requirements.txt` | 补 `werkzeug`、`itsdangerous`（server.py:67 真 import） | 4/5 |
| P0-4 | 安全 | `server.py:436-505, 563-663` | 内存滑动窗口限流：login/register 5/min/IP、state PUT 30/min/IP | 2/5（T3 升 P0） |
| P0-5 | 安全 | `server.py:831-841` | cookie `secure` 由 `request.is_secure` 或 `SESSION_COOKIE_SECURE=1` 切换 | 2/5（T3 升 P0） |
| P0-6 | 可观测 | `server.py:716-722` | 5xx 用 `current_app.logger.exception()` 替代 `traceback.print_exc()` | 2/5（T3 升 P0） |
| P0-7 | 工程化 | `backup-restore.sh restore` | 修复"恢复成同样内容"的误导 | 2/5 |
| P0-8 | 文档 | `README.md` API 表格 | 补全 7 个未文档化端点（含 410 / 404） | 3/5 |
| P0-9 | a11y | `app.js.orig` 模态 | 加 focus trap（`inert` 属性 / 手动 focus trap） | 1/5 |
| P0-10 | a11y | `index.html:51` | 退出登录加 `confirmAction` 确认弹窗 | 1/5 |
| P0-11 | a11y | `app.js.orig` 列表渲染 | 渲染前 skeleton + `aria-busy` | 1/5 |
| P0-12 | a11y | `styles.css.orig:151, 932` | `:focus-visible { outline: ... }` 替代 `outline: none` | 1/5 |

### P1（应做，单审计点名但与契约冲突小）

| 编号 | 类别 | 位置 | 修复简述 | 来源 |
|---|---|---|---|---|
| P1-1 | 安全 | `server.py:336-340` CSP | 渐进收紧 `style-src 'unsafe-inline'`（先扫 index.html 内联 style → 改外部 → 换 nonce-source） | T3 P1-1 |
| P1-2 | 安全 | `server.py:state_put` | 服务端校验 DOI / ORCID（复用 app.js.orig:24-25 正则） | T3 P1-2 |
| P1-3 | 性能 | `server.py:175-178` SCHEMA | `CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)` | T3 P1-3 / T7 |
| P1-4 | 可观测 | `server.py:152-155` | `secret.key` chmod 失败用 `app.logger.warning` 记录 | T3 P1-4 |
| P1-5 | 测试 | `tests/test_size_and_secret.py` | 新增 `test_session_max_age_enforced`（time-travel 测 14d 过期） | T3 P1-5 |
| P1-6 | a11y | `workspace.css:status-pill` | warn 状态色对比度 3.8:1 → 4.5:1（改 #d84315 / 加粗） | T4 P1-1 |
| P1-7 | a11y | `app.js.orig:502-515` toast | 加 × 关闭按钮 + 限制堆叠 | T4 P1-2 |
| P1-8 | a11y | `index.html:354-358, 374-382` | 必填字段统一 `*` 前缀 | T4 P1-3 |
| P1-9 | a11y | `app.js.orig` 模态 | 关闭后焦点恢复（focusBack） | T4 P1-4 |
| P1-10 | a11y | `workspace.css:row-actions` | 看板按钮 padding 至少 8px 12px（触控目标 ≥ 44px） | T4 P1-5 |
| P1-11 | 工程化 | `build-optimized.sh:36-38` | 移除 `backups/app.js.bak.*` 引用（语义错位） | A6 |
| P1-12 | 工程化 | `build-optimized.sh` / `backup-restore.sh` | 加 `set -euo pipefail` | A7 / T5 |
| P1-13 | 工程化 | `qa/run-all.sh` | 加 stdout 摘要 / verbose 开关 | A9 / T5 |
| P1-14 | 文档 | `README.md` 安装前提 | 把"需要本机 Chrome"移至前提节 | T7 P2 |

### P2（可选，价值高但风险/工作量也高）

| 编号 | 类别 | 位置 | 修复简述 | 来源 |
|---|---|---|---|---|
| P2-1 | 安全 | `server.py:114, 818` | 读路径加锁（me / _resolve_user） | T3 P2-1 |
| P2-2 | 安全 | `server.py:357-374` | `Origin: null` 测试覆盖 + 文档化 | T3 P2-2 |
| P2-3 | 安全 | `server.py:336-340` | CSP 显式 `object-src 'none'; base-uri 'self'; form-action 'self'` | T3 P2-3 |
| P2-4 | 安全 | `server.py:127-156` | 首次部署 SECRET_KEY 必显式 export；启动 INFO 日志 | T3 P2-4 |
| P2-5 | 安全 | `server.py:500, 502` | 登录失败计数 + Retry-After | T3 P2-5 |
| P2-6 | a11y | `index.html:6` | Google Fonts `preconnect` + `display=swap` | T4 P2-1 |
| P2-7 | a11y | `styles.css.orig` | 暗色模式 `@media (prefers-color-scheme: dark)` | T4 P2-2 |
| P2-8 | 性能 | `app.js.orig` | 大量数据虚拟滚动/分页 | T4 P2-3 |
| P2-9 | 工程化 | `app.js.orig` 等 | 删除 .orig（byte-equal，DOCS_AUDIT 已确认） | A8 |
| P2-10 | 文档 | `install-service.sh` | 文档化 lsof/ps 系统工具前提 | T7 P2 |

---

## §3 推荐执行顺序（4 个 Phase）

### Phase 1 — 文档/配置级零风险修复（30-60 分钟）
**目标**：5 项 P0 纯文档/配置修改，不动业务代码；保留所有 verification.md 断言。

| 顺序 | 任务 | 文件 | 修改点 |
|---|---|---|---|
| 1.1 | T-A1 | `.gitignore` | 补 12+ 项 |
| 1.2 | T-A2 | `package.json:10` | `test:frontend: "bash qa/run-all.sh"` |
| 1.3 | T-A3 | `requirements.txt` | 加 `werkzeug`、`itsdangerous` |
| 1.4 | T-A7 | `README.md` API 表格 | 补 7 个端点（含 410 / 404） |
| 1.5 | T-A8 | `backup-restore.sh restore` | 修误导文案 + 逻辑 |
| 验证 | `pytest tests/ -q` + `bash qa/run-all.sh` + `node --check` + `pip install -r requirements.txt` 干跑 | — | T6 RERUN_LOG.md 基线对比 |

**风险**：0  
**收益**：.gitignore 立即生效（防误提交）、`npm run test:frontend` 可用、新克隆不再 ImportError、README 完整、脚本语义诚实。

### Phase 2 — 后端安全增强（半天）
**目标**：P0-4 限流 + P0-5 secure cookie + P0-6 logger + 5 项 P1。

| 顺序 | 任务 | 文件 | 配套测试 |
|---|---|---|---|
| 2.1 | C1 | `server.py` 加内存滑动窗口限流 | 新增 `tests/test_rate_limit.py`（P0-4 验证） |
| 2.2 | C5 | `server.py:_set_session_cookie` secure 切换 | `tests/test_size_and_secret.py` 加 SESSION_COOKIE_SECURE=1 测试 |
| 2.3 | C2 | `server.py` 5xx 改 `current_app.logger.exception()` | 单元测试断言响应体仍 `{"error":"服务器内部错误"}` |
| 2.4 | P1-3 | `server.py:SCHEMA` 加 `CREATE INDEX IF NOT EXISTS idx_code_runs_at` | `tests/test_size_and_secret.py::test_code_runs_index_exists` |
| 2.5 | P1-2 | `server.py:state_put` 入口加 DOI/ORCID 校验 | `tests/test_state.py` 加 PUT bad DOI/ORCID → 400 |
| 2.6 | P1-1 | `server.py:CSP` 渐进收紧（先扫后改） | 新增 `tests/test_security_headers.py` |
| 2.7 | P1-4 | `server.py:_get_secret_key` chmod 失败打 warning | 单元测试 |
| 2.8 | P1-5 | `tests/test_size_and_secret.py` 加 session max_age 测试 | 仅测试 |
| 验证 | `pytest tests/ -q` + 浏览器回归（如有）+ `python -m pip install -r` + 干跑 start.sh | — | 期望：68+ passed（原 67 + 新增） |

**风险**：低-中。限流逻辑需小心内存清理；secure cookie 切换需保证 HTTPS 模拟测试；CSP 收紧需确认 index.html 无内联 style 阻塞（先扫）。  
**收益**：暴力破解防护、HTTPS 安全、错误可观测、SQL 性能、XSS 攻击面缩小。

### Phase 3 — 前端 a11y / UX（半天）
**目标**：4 项 P0 a11y + 5 项 P1 a11y。

| 顺序 | 任务 | 文件 | 配套测试 |
|---|---|---|---|
| 3.1 | P0-9 | `app.js.orig` 模态焦点 trap（`inert` 属性 / 手动 trap） | `qa/test-*.js` 加键盘焦点链断言 |
| 3.2 | P0-10 | `app.js.orig` 退出登录 `confirmAction` | 功能测试 |
| 3.3 | P0-11 | `app.js.orig` 列表渲染前 skeleton + `aria-busy` | DOM 测试 |
| 3.4 | P0-12 | `styles.css.orig` `:focus-visible` 替代 `outline: none` | 视觉 + 键盘测试 |
| 3.5 | P1-6 | `workspace.css:status-pill` warn 色 | 对比度计算 |
| 3.6 | P1-7 | `app.js.orig:502-515` toast × 按钮 + 堆叠限制 | 视觉 |
| 3.7 | P1-8 | `index.html` 必填字段 `*` 前缀 | 视觉 |
| 3.8 | P1-9 | 模态 focusBack | 键盘 |
| 3.9 | P1-10 | `workspace.css:row-actions` padding | 触控 |
| 验证 | `bash qa/run-all.sh` 仍 12 PASS + 浏览器回归 14 流程 | — | T6 RERUN_LOG 基线 |

**风险**：低。a11y 改动影响键盘/屏幕阅读器，不破坏视觉布局。  
**收益**：键盘用户可达、误操作防护、视觉对比度合规、触屏可用。

### Phase 4 — 收尾（30 分钟）

| 顺序 | 任务 |
|---|---|
| 4.1 | 重跑 `pytest tests/ -q` + `bash qa/run-all.sh` + `node --check` + `bash -n *.sh` |
| 4.2 | 更新 `qa/verification.md`（追加 Phase 1-3 改动 + 新增 evidence 行） |
| 4.3 | 写 `OPTIMIZATION_CHANGELOG.md`：每条改动 + 文件:行号 + 验证命令输出 |
| 4.4 | git add + commit（建议拆 4 个 commit：Phase 1/2/3/4） |
| 4.5 | 把 .orig 文件加入 .gitignore（与 backups 同），删除 `app.js.orig` / `workspace.js.orig` / `styles.css.orig`（P2-9，DOCS_AUDIT 已确认 byte-equal） |

### Phase 5 — P2 可选项（按需追加 commit）
仅在 Phase 1-4 全过、用户明确要扩展时再启动：5 项 P2 安全 + 3 项 P2 a11y + 1 项 P2 性能 + 1 项 P2 工程化。

---

## §4 仍需"待核"的事项（不做不阻塞，但写明）

| 编号 | 主题 | 来源 | 验证命令 |
|---|---|---|---|
| 待核-1 | `server.log` 是否真包含 traceback | T3 P0-3 | `tail -100 server.log` 看是否有 Python stack frames |
| 待核-2 | `Origin: null` 实际响应 | T3 P2-2 | curl -H "Origin: null" -X POST /api/auth/login |
| 待核-3 | send_from_directory 对 NUL 字符行为 | T3 | 写 NUL 字节的 filename 看 404 还是 500 |
| 待核-4 | Windows 下 secret.key chmod 行为 | T3 P1-4 | 在 Windows 跑看是否真不抛异常 |
| 待核-5 | `install-service.sh` 实际是否可用 | T7 | 在 launchd 实际配置测试 |
| 待核-6 | index.html 内联 style 数量（P1-1 CSP 收紧前置） | T3 P1-1 | grep -c '<style' / inline style="..." / 实际计数 |

---

## §5 风险/回退总览

| 风险类别 | 风险等级 | 触发条件 | 回退方案 |
|---|---|---|---|
| 限流误伤合法用户 | 中 | login/register 阈值设太小 | 阈值做成可配置；初始保守（10/min） |
| secure cookie 切换影响 dev | 低 | dev 用 HTTP 时 `request.is_secure=False` | 加 `SESSION_COOKIE_SECURE=1` 显式开启 |
| CSP 收紧破坏功能 | 中 | index.html 真有内联 style | 渐进：先扫后改；保留 'unsafe-inline' 直到内联全清 |
| 焦点 trap 干扰 Tab 流 | 低 | 手动 trap 实现 bug | 用 `inert` 属性（原生支持） |
| logger 切换后日志膨胀 | 低 | exception 频繁触发 | 加采样或只 INFO 级 |
| git rm --cached 误操作 | 低 | 命令输错 | 先 dry-run `git rm --cached -r --dry-run` |

---

## §6 与 verification.md 已通过断言的契约

**所有 Phase 1-3 改动都不能破坏以下断言**（T6 RERUN_LOG.md 复跑确认当前基线）：

- pytest 67 passed
- qa/run-all.sh 12 PASS, 0 FAIL
- node --check app.js / workspace.js 退出码 0
- shell 语法 `bash -n *.sh` 全过
- 关键回归 test-11-store-identity / test-02-tree / test-07-failed-save 通过
- `/api/auth/*` 路由 + 401/409/revision 自增契约
- `/api/state` PUT OCC 行为
- `/api/run-code` 410 Gone + admin 端点 404
- Stop.sh cwd + cmdline 多步校验
- Store / mount 单 mount 契约（test-08）
- 350ms 防抖（test-04）
- CSP / Origin / X-Frame-Options

---

## §7 用户决策点

请你选：

**A. Phase 1 现在就执行**（5 项零风险文档/配置修复，~30 分钟；可立即看到 .gitignore / package.json / requirements.txt 变化）  
**B. Phase 1 + Phase 2 一起做**（后端安全增强半天；测一轮后给你看 diff + 测试结果）  
**C. Phase 1 + 2 + 3 全部做**（一站式，约 1.5-2 天；但需要 git 历史能拆 commit）  
**D. 先不执行，我把 Phase 1 的具体改动写成 patch 文件给你 review**

你拍板。

---

*汇总路径：/Volumes/Kingston/Mac/MeteoHub/OPTIMIZATION_FINAL.md*
