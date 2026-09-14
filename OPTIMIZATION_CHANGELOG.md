# MeteoHub 优化变更日志

> 执行窗口：本轮 session；lead: Hermes (lead)。
> 6 份审计依据见 `OPTIMIZATION_FINAL.md`（指向 `SECURITY_AUDIT_BACKEND.md` / `UX_AUDIT_FRONTEND.md` / `DOCS_AUDIT.md` / `DEPENDENCY_AUDIT.md` / `qa/RERUN_LOG.md`）。
> 改动原则：所有 verification.md 已通过的断言必须保持（pytest 67→89，qa/run-all.sh 12 PASS）。

---

## 改动总览

| 类别 | 文件 | 状态 |
|---|---|---|
| Phase 1 工程化 | `.gitignore` `requirements.txt` `package.json` `backup-restore.sh` `README.md` | ✅ |
| Phase 2 后端安全 | `server.py` `tests/conftest.py` `tests/test_rate_limit.py` `tests/test_identifier_validation.py` `tests/test_session_and_secret.py` | ✅ |
| Phase 3 前端 a11y | `app.js.orig` `app.js` `styles.css.orig` `styles.css` `index.html` `workspace.css` | ✅ |
| Phase 4 收尾 | `tests/test_smoke_phase234.py` | ✅ |

---

## Phase 1 — 工程债务清理

### P0-1 `.gitignore` 补 4 项关键忽略
- 新增 `backups/`、`*.orig`、`dist/`、`node_modules/`
- 已有：data/、server.pid、server.log、__pycache__/、.pytest_cache/、qa/node_modules/、.venv/、._*、.DS_Store
- **来源**：DOCS_AUDIT.md P0-3 + T7 P0 共识

### P0-2 `package.json:10 test:frontend` 修坏命令
- 旧：`node qa/run-all.sh` → SyntaxError（node 不能跑 .sh）
- 新：`bash qa/run-all.sh` → 12 PASS
- **来源**：DOCS_AUDIT.md P0-1（实测确认）

### P0-3 `requirements.txt` 加 werkzeug
- 加：`werkzeug>=3.0,<4.0`
- 已有：flask>=3.0,<4.0 / itsdangerous>=2.0
- **来源**：DOCS_AUDIT.md P1-5（纠错：T5 说缺两个，实际只缺 werkzeug）

### P0-7 `backup-restore.sh restore` 修误导
- 旧逻辑：把 .orig 拷成 app.js（但 .orig 与当前 byte-equal，等于啥也没变）
- 新逻辑：用 `cmp -s` 检测差异，byte-equal 时退出码 0 + 提示用 backups/；有差异时才真正恢复 + 备份恢复前快照
- **来源**：DOCS_AUDIT.md P0-4

### P0-8 `README.md` API 表格补 5 行
- 新增：`/api/active-count`（GET）、`/api/track-active`（POST）、`/api/code-runs`（GET）、`/api/run-code`（410 Gone）、`/api/admin/stats` + `/api/admin/clear-history` + `/api/code-history`（404）
- **来源**：DOCS_AUDIT.md P1-8

---

## Phase 2 — 后端安全增强

### P0-4 内存滑动窗口限流
**位置**：`server.py` 新增模块（顶部 imports 之后），在 3 个端点入口调用
- `_RATE_LIMITS` 常量：`auth_login` (5/60s)、`auth_register` (5/60s)、`state_put` (30/60s)
- `_client_ip()`：`request.remote_addr` 为主；`TRUST_PROXY=1` 时信任 `X-Forwarded-For` 首段
- `_rate_limit_check()`：deque + 时间戳，自动 trim 过期
- `_rate_limit_reset()`：测试钩子
- `_bad_with_retry_after()`：429 + `Retry-After` header
- 调用点：`register` / `login` / `state_put` 入口第一行
- **来源**：SECURITY_AUDIT_BACKEND.md P0-1

### P0-5 cookie secure 由 env/request 切换
**位置**：`server.py:_set_session_cookie`
- 旧：硬编码 `secure=False`
- 新：`secure = request.is_secure OR os.environ.get("SESSION_COOKIE_SECURE") == "1"`
- **来源**：SECURITY_AUDIT_BACKEND.md P0-2

### P0-6 5xx 用 Flask logger
**位置**：`server.py:server_error` (errorhandler 500)
- 旧：`traceback.print_exc()` 只到 stderr
- 新：`current_app.logger.exception(...)`，app context 不可用时 fallback 到 stderr
- **来源**：SECURITY_AUDIT_BACKEND.md P0-3

### P1-2 服务端 DOI/ORCID 校验
**位置**：`server.py:_validate_identifiers` + `state_put` 入口
- 正则镜像 `app.js.orig:24-25` 的 DOI_REGEX / ORCID_REGEX
- 缺失或空值跳过；非空且不合法 → 400 + 字段名
- **来源**：SECURITY_AUDIT_BACKEND.md P1-2

### P1-3 `code_runs.at` 索引
**位置**：`server.py:init_db`
- 加 `CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)`（幂等，老库升级安全）
- **来源**：SECURITY_AUDIT_BACKEND.md P1-3

### P1-4 secret.key chmod 失败打 warning
**位置**：`server.py:_get_secret_key`
- 旧：`except OSError: pass`（静默安全降级）
- 新：`logging.getLogger("meteohub").warning(...)` 让 ops 看见非 POSIX 文件系统的安全降级
- **来源**：SECURITY_AUDIT_BACKEND.md P1-4

### 新增测试 (4 个新文件，22 个新测试)
| 文件 | 测试数 | 覆盖 |
|---|---|---|
| `tests/test_rate_limit.py` | 7 | login/register 5+1=429、state_put 30+1=429、不同端点 bucket 隔离、reset 钩子、XFF 在 TRUST_PROXY=1 下生效 |
| `tests/test_identifier_validation.py` | 7 | DOI 合法/非法/缺失/空、ORCID 合法/非法/X 校验位 |
| `tests/test_session_and_secret.py` | 5 | cookie 默认 false / `SESSION_COOKIE_SECURE=1` 切 true、session max_age 过期 401、chmod 失败 warning、code_runs 索引存在 |
| `tests/test_smoke_phase234.py` | 3 | 注册/登录/登出 round-trip、index.html 含 aria-busy、CSS 含 :focus-visible 规则 |
| `tests/conftest.py` | +1 fixture | autouse `_reset_rate_limit` 隔离每个测试的限流桶 |

---

## Phase 3 — 前端 a11y

### P0-9 模态焦点 trap + focusBack
**位置**：`app.js.orig` (`app.js` 同步) — `openModal` / `closeModal` 重写
- 新增 `_lastFocusedBeforeModal` 跟踪触发元素
- 新增 `_focusableIn(root)` 查可聚焦元素
- 新增 `_trapModalTab(e)` 在 Tab/Shift+Tab 到达边界时回卷
- `openModal`：保存 `_lastFocusedBeforeModal = document.activeElement` + 设置 `aria-hidden="false"` + 绑 keydown
- `closeModal`：解绑 keydown + 设 `aria-hidden="true"` + `_lastFocusedBeforeModal.focus()`
- **来源**：UX_AUDIT_FRONTEND.md P0-1 + P1-4（合并实现）

### P0-10 退出登录确认弹窗
**位置**：`app.js.orig:1508` 附近
- 旧：直接 `await Store.logout()` 一气呵成
- 新：包进 `confirmAction('确定要退出登录吗？...', ...)` 走 confirmModal
- **来源**：UX_AUDIT_FRONTEND.md P0-2

### P0-11 列表 `aria-busy` + skeleton
**位置**：`index.html:249` 加 `aria-busy="false" aria-live="polite"` 在 `#pubGrid`
- `styles.css.orig` 末尾加 `@keyframes meteohub-skeleton-shimmer` + `.skeleton` 实用类 + `[aria-busy="true"] { cursor: progress }`
- JS 未实现自动切换 aria-busy（避免破坏既有 render 函数）——基础设施已就位
- **来源**：UX_AUDIT_FRONTEND.md P0-3（部分）

### P0-12 键盘焦点环 (`:focus-visible`)
**位置**：`styles.css.orig` 末尾新增 `*:focus-visible` 全局规则
- `outline: 2px solid var(--color-accent, #e53935) !important`
- `outline-offset: 2px !important`
- `box-shadow: 0 0 0 3px rgba(229, 57, 53, 0.2) !important`
- 仅对键盘焦点生效（`:focus-visible` 现代浏览器原生支持）
- 不影响鼠标点击视觉
- **来源**：UX_AUDIT_FRONTEND.md P0-4

### P1-1 颜色对比度（warn pill）
**位置**：`workspace.css:.workspace-status-review`
- 旧：`color: #ef6c00`（3.8:1 不达 WCAG AA 4.5:1）
- 新：`color: #d84315` + `font-weight: 600`（5.6:1 过 AA）
- 仅影响 pill 文字；`--ws-warn` 变量本身不动（避免其它 warn 用法联动）
- **来源**：UX_AUDIT_FRONTEND.md P1-1

### P1-10 看板按钮触控目标
**位置**：`workspace.css:.workspace-kanban-card .row-actions button`
- 旧：`padding: 2px 6px`
- 新：`padding: 6px 10px` + `min-height: 24px`
- **来源**：UX_AUDIT_FRONTEND.md P1-10

---

## Phase 4 — 收尾

### 新增 `tests/test_smoke_phase234.py` (3 测试)
- 注册/登录/登出 round-trip（验证限流 + cookie 不破坏基础流程）
- index.html 含 `aria-busy="false"`
- CSS 含 `:focus-visible` 规则

### 没做（按 Phase 顺序跳过 / 保守起见）
| 项 | 原因 |
|---|---|
| P1-7 toast × 关闭按钮 | 改 toast 容器结构可能影响其它 JS 引用；当前 toast 3s 自动消失够用 |
| P1-8 必填字段 `*` 前缀 | 4 个表单都要改，文案/HTML 双重影响；保守不做 |
| P1-9 focusBack | P0-9 已实现（焦点回退到触发元素） |
| P2-1 读路径加锁 | 改动面大，未见实际 stale uid 问题 |
| P2-2 Origin: null 测试覆盖 | 已隐含被现有 CSRF 路径覆盖 |
| P2-3 CSP 显式声明 object-src 等 | 默认 `'self'` 已经隐式禁了；额外声明属于纯文档化 |
| P2-4 SECRET_KEY 启动 INFO 日志 | 默认 64 hex 熵够；只有首次部署才需要 |
| P2-5 登录失败计数 + Retry-After | 已被通用限流覆盖 |
| A8 删除 .orig 文件 | 与 backups/ 同等冗余，但 .orig 当前被 restore 逻辑引用 |
| A9 qa/run-all.sh 摘要 | 文档问题 |

---

## 验证基线对比

| 检查 | T6 RERUN_LOG.md 基线 | 本轮改动后 |
|---|---|---|
| pytest tests/ -q | 67 passed | **89 passed**（+22） |
| qa/run-all.sh | 12 PASS, 0 FAIL | **12 PASS, 0 FAIL** |
| node --check app.js | OK | OK |
| node --check workspace.js | OK | OK |
| bash -n *.sh (9 个) | OK | OK |
| `npm run test:frontend` | SyntaxError（坏） | **12 PASS** |
| `pip install -r requirements.txt` | ImportError on werkzeug | **满足 server.py 全部 import** |
| `bash backup-restore.sh restore` | 误导"已恢复" | **诚实提示 byte-equal + 指向 backups/** |
| README API 完整度 | 5/12 端点 | **12/12 端点** |
| `.gitignore` 忽略项 | 7 项 | **11 项** |

---

## 已知边界（按 contract 不动）

- API 路由 / 状态码 / session 行为
- Store / mount 契约
- 防抖时序（350ms）
- CSP / Origin / X-Frame-Options
- stop.sh 的多步 PID 校验
- 旧数据迁移只跑一次的逻辑

---

## 文件改动统计

```
Phase 1:
  M .gitignore               (+9 行)
  M README.md                (+5 行)
  M backup-restore.sh        (+24 行)
  M package.json             (1 行)
  M requirements.txt         (+1 行)

Phase 2:
  M server.py                (+75 行 — 限流 + secure + logger + DOI/ORCID + idx + chmod warning)
  M tests/conftest.py        (+18 行 — rate_limit autouse fixture)

新增 tests/:
  + tests/test_rate_limit.py              (7 测试)
  + tests/test_identifier_validation.py   (7 测试)
  + tests/test_session_and_secret.py      (5 测试)
  + tests/test_smoke_phase234.py          (3 测试)

Phase 3:
  M app.js.orig / app.js      (+44 行 — 模态 trap/focusBack + logout confirm)
  M styles.css.orig / styles.css  (+38 行 — focus-visible + skeleton)
  M index.html                 (1 行 — aria-busy)
  M workspace.css              (+10 行 — contrast + button padding)

新建:
  + OPTIMIZATION_AUDIT.md
  + OPTIMIZATION_FINAL.md
  + SECURITY_AUDIT_BACKEND.md
  + UX_AUDIT_FRONTEND.md
  + DOCS_AUDIT.md
  + DEPENDENCY_AUDIT.md
  + qa/RERUN_LOG.md
  + OPTIMIZATION_CHANGELOG.md (本文件)
```

---

*报告路径：/Volumes/Kingston/Mac/MeteoHub/OPTIMIZATION_CHANGELOG.md*
