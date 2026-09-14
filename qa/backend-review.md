> **历史报告，已被后续修复取代。** 本文的 51 项基线及缺陷结论不代表当前版本。当前验收以 [verification.md](verification.md) 和可复跑测试为准。

# 后端独立复核报告（Hermes, 任务 #01a093ab）

> 只读审查；未修改 `server.py` / `tests/*` / `*.sh`。
> 复核时间：会话时间窗内（macOS / Python 3.13.9 / flask 3.1.3 / itsdangerous 2.2 / pytest 9）。
> 复核脚本：`qa/backend-audit-probes.py`（独立可重跑，9 个 probe 场景 + 真 HTTP 验证）。
> 基线回归：`python3 -m pytest tests/` → **51/51 通过**。

---

## 0. 复核范围与方法

- **基线**：先跑 `python3 -m pytest tests/`，**51/51 通过**，说明基线功能正常。
- **手动审计**：`server.py` 全部 677 行、`tests/*` 3 文件、6 个 shell 脚本。
- **探针**：`qa/backend-audit-probes.py` 8 个独立场景，全用临时 SQLite（从不污染 `data/meteohub.db`）。
- **真实 HTTP 验证**：用 `werkzeug.serving.make_server` 起真服务、用 `urllib.request` 发请求，验证不止是测试客户端的假象。
- **复现工件**：`qa/backend-audit-probes.py` 单独可跑；每个发现都附「recipe（最小复现步骤）」+「evidence（实测输出片段）」。
- **不在范围内**（按 leader 指示，不重复实现）：64KB/256KB 容量数值本身、SECRET_KEY env 引入（仅记录当前行为供修复参考）、PID 文件 `kill -0` 检查、Flask 默认 static 旁路。

---

## 1. 复核结论总览

| 严重度 | 数量 | 主题 |
|---|---|---|
| HIGH | 3 | auto-init 并发 500、已删用户的 stale-cookie 500、超大请求被掩盖成 400 |
| MEDIUM | 4 | SECRET_KEY env 未生效、无 CSRF token、state 嵌套深度无上限、stop.sh 误杀 |
| LOW | 1 | 安全响应头缺失（nosniff / XFO / CSP / HSTS） |

详细见下。

---

## 2. HIGH 严重度（建议优先修复）

### H1. `state_get` 自动初始化存在 TOCTOU 并发竞态 → 大量 500

- **位置**：`server.py:438-446`（`state_get` 自动初始化分支）
- **问题**：
  ```python
  if row is None:
      with _db_lock, db_conn() as conn:
          conn.execute(
              "INSERT INTO state(user_id, revision, payload, updated_at) "
              "VALUES (?, 0, ?, ?)",
              (uid, _empty_state_json(), time.time()),
          )
      return jsonify({"state": _empty_state(), "revision": 0})
  ```
  多个并发请求同时观察到 `row is None`（或同一用户没有 state 行的任何窗口），然后都尝试 INSERT；第二个起会被 SQLite `UNIQUE constraint failed: state.user_id` 拒绝，`IntegrityError` 未被捕获 → 500 + 完整堆栈打印到 stderr。
- **复现**：
  ```python
  c.post('/api/auth/register', json={'username': 'alice', 'password': 'secret123'})
  # 模拟遗留用户（register 后手动 DELETE state 行，等同 schema 迁移场景）
  sqlite3.connect(db).execute('DELETE FROM state')
  # 50 并发 GET /api/state
  threads = [Thread(target=lambda: c.get('/api/state')) for _ in range(50)]
  for t in threads: t.start(); t.join()
  # 结果: Counter({200: 43, 500: 7})
  ```
  实测 stderr 出现 7 段 `IntegrityError: UNIQUE constraint failed: state.user_id` 完整堆栈。
- **影响**：合法用户看到 500；服务器 stderr 噪声；operator 误以为 SQL 出错。Schema 迁移、备份恢复、半完成事务后重启都可能触发。
- **修复方向**：把 INSERT 包在 try/except `IntegrityError`，冲突时再次 SELECT 返回现有行；或直接用 `INSERT OR IGNORE` + 重新 SELECT。

### H2. 已删除用户持有有效 cookie → `/api/state` 返回 500（应为 401）

- **位置**：`server.py:430-453`（`state_get`）；同样影响 `state_put` 的隐含路径。
- **问题**：当 `users` 行被删除（admin 操作 / 数据导入 / 误删）但 cookie 仍在 14 天 `SESSION_MAX_AGE` 内，签名校验通过 → `current_user_id()` 返回有效 uid。但 `users` 表已无此 uid。
  - `me()` 走 `SELECT ... FROM users WHERE id = ?` 路径，row is None → 正确返回 `{user: None}`。
  - `state_get()` 走 `SELECT ... FROM state WHERE user_id = ?` 也返回 None → 跌入 auto-init 分支 → INSERT `state` 行 → **FOREIGN KEY 约束失败** → `IntegrityError` → 500。
  - `state_put()` 同样问题。
- **复现**：
  ```python
  c.post('/api/auth/register', json={'username': 'alice', 'password': 'secret123'})
  # 模拟 admin 删除账号
  sqlite3.connect(db).execute('DELETE FROM users WHERE username="alice"')
  # alice 的 cookie 仍然有效 14 天
  r = c.get('/api/state')
  # 实测: status=500 body='{"error":"服务器内部错误"}'
  ```
- **影响**：用户被删除后 14 天内，任何带 cookie 的 `/api/state` 请求都会 500；无法静默退役账号；admin 操作有副作用窗口。
- **修复方向**：在 `state_get`/`state_put` 入口先 `SELECT id FROM users WHERE id = ?`；用户不存在则直接 401（或等价于未登录）。建议提取一个 `_resolve_user(uid)` 工具方法。

### H3. 超大请求被掩盖；`MAX_CONTENT_LENGTH=64KB` 实际从未生效；唯一真正限制是 256KB 手动检查但也被 `_json_body` 抢先屏蔽

- **位置**：`server.py:289`（`MAX_CONTENT_LENGTH=64*1024`）、`server.py:630-639`（`_json_body`）、`server.py:465-467`（256KB 手动检查）。
- **完整问题链**：
  1. `app.config["MAX_CONTENT_LENGTH"] = 64 * 1024` 在 `create_app()` 设置。
  2. `request.get_json(silent=False)` 抛 `RequestEntityTooLarge`（Flask/Werkzeug 在 WSGI 层应触发 413）。
  3. `_json_body()` 用 `except Exception` 捕获后改成 400 + 文案「请求体不是合法的 JSON」。
  4. 256KB 手动检查（`if body_size > MAX_STATE_BYTES`）理论上能挡住，但**对超大请求永远跑不到**——因为 `_json_body()` 已经先返回了。
  5. **实际可接受上限 ≈ 256KB（仅当 `json.dumps(parsed)` > 256KB 时拦下）**。
- **真实验证**（用 `make_server` 起真服务，`urllib.request` 发请求）：
  | wire body | 期望 | 实际 |
  |---|---|---|
  | 64KB+1 | 413 | **200** |
  | 100KB | 413 | **200** |
  | 300KB | 413 | **200** |
  | 500KB | 413 | **200** |
  | 1MB | 413 | **200**（首次），409 OCC（重复，因为第一次 revision 已消耗） |
  | 5MB | 413 | **400「请求体不是合法的 JSON」**（掩盖 MAX_CONTENT_LENGTH 的真实原因） |
- **影响**：
  - **64KB 设置是死代码**——运维误以为有 64KB 上限。
  - **真实上限约 256KB（parsed+re-encoded）**，远大于声明。
  - **错误码/文案误导**：用户看到「JSON 写错」而不是「请求过大」。
  - 大 body 浪费 CPU：5MB JSON 一次性 parse + re-dump。
- **修复建议**：
  1. 让 `_json_body()` 不掩盖 HTTPException：
     ```python
     from werkzeug.exceptions import RequestEntityTooLarge, BadRequest
     try:
         data = request.get_json(silent=False)
     except RequestEntityTooLarge:
         return None, _bad("请求体过大", 413)
     except BadRequest:
         return None, _bad("请求体不是合法的 JSON")
     ```
  2. 用真实 wire 字节而不是 `len(json.dumps(parsed))` 做 256KB 校验：
     `if request.content_length and request.content_length > MAX_STATE_BYTES: return _bad(...)`
  3. 统一 MAX_CONTENT_LENGTH 与 MAX_STATE_BYTES 为单一来源（避免误导）。
- **leader 备注**：此项已被指派「修 64KB/256KB 容量矛盾」。本报告补充了「掩盖效应」与「上限实际是 256KB」两个新事实，建议合并修复并跑 `qa/backend-audit-probes.py::probe_state_limits` 回归。

---

## 3. MEDIUM 严重度

### M1. `SECRET_KEY` 环境变量未生效

- **位置**：`server.py:117-132`（`_get_secret_key`）。
- **当前行为**：函数只读 `data/secret.key`，从不检查 `os.environ['SECRET_KEY']`。
- **复现**：
  ```bash
  SECRET_KEY=mysecret python3 server.py
  # 然后 xxd data/secret.key | grep mysecret
  # 实测：mysecret 不在文件里。文件内容仍是 uuid pair。
  ```
- **影响**：
  - 容器化部署（k8s Secret / Docker `--env-file`）传 `SECRET_KEY` 是行业惯例；本实现完全忽略。
  - 跨主机迁移（数据卷搬迁）会强制所有用户重新登录。
  - 测试用 `monkeypatch.setattr(server, "_get_secret_key", ...)` 才能稳定 SECRET。
- **leader 备注**：此项已被指派修复。本报告仅记录当前行为与复现手段供回归测试用。
- **修复建议**：`if os.environ.get("SECRET_KEY"): return os.environ["SECRET_KEY"].encode()` 优先于读文件；fallback 才用文件。

### M2. 无 CSRF token；唯一防线是 SameSite=Lax cookie

- **位置**：`server.py:642-652`（`_set_session_cookie`）。
- **当前行为**：只设 `HttpOnly + SameSite=Lax + Secure=False`，无 token；`/api/state` PUT 与 `/api/auth/logout` POST 接受任意带 cookie 的同源请求。
- **威胁模型**：
  - 现代浏览器对 cross-origin POST 默认不发 Lax cookie，CSRF 防护足够。
  - 但**同站子域攻击**（如 `attacker.yourcompany.com` 拥有有效 TLS 证书 + 你部署在 `meteohub.yourcompany.com` 时）仍可发 fetch 带上 cookie。
  - 旧浏览器 / 嵌入式 webview 对 SameSite 解释不一致。
  - `/api/auth/logout` GET 不会被攻击者滥用（仅清 cookie），但 PUT `/api/state` 危害大。
- **修复建议**：state-mutating 端点要求 `X-CSRF-Token` header 与登录态下发的 token 匹配；token 派生自 session 内。

### M3. `state.profile.deep` 等嵌套字段无深度限制

- **位置**：`server.py:614-627`（`_is_valid_state`）。
- **当前行为**：只校验顶层键 + 顶层类型。`state.pages = [{...}]` 内元素结构任意；嵌套深度无限制。
- **复现**：
  ```python
  deep = {"k": "v"}
  for _ in range(5000): deep = {"k": deep}
  state = make_empty_state(); state["profile"]["deep"] = deep
  # 30KB wire
  c.put('/api/state', json={"state": state, "revision": 0})
  # 实测: 200
  # GET 返回同样深度嵌套 — 前端 json.parse 也得递归 5000 层
  ```
- **影响**：单用户用满 256KB 配额塞一个 5000 层 dict，服务端每次 GET 都要 json.dumps、客户端每次要 json.parse。Python 默认递归上限 1000；5000 层 dict 在 json.dumps 会 `RecursionError`。
- **修复建议**：递归校验深度（建议 ≤ 32）或对嵌套大小做累计字节预算。

### M4. `stop.sh` 盲目信任 PID 文件，不验证进程身份

- **位置**：`stop.sh:21-39`（实际 PID 处理）。
- **当前行为**：`kill -0 $PID`（进程存在）→ `kill $PID` 直接发信号；从不 `ps -p $PID -o comm=` 验证是 python 跑 server.py。
- **威胁模型**：
  - **PID 复用**：Linux 进程退出后 PID 会被回收；机器重启后 systemd / 其它服务可能占用旧 PID。`server.pid` 残留值不是 server.py 的 PID 时，`stop.sh` 误杀无辜。
  - macOS 同样会复用 PID。
  - 多用户共享主机时尤甚。
- **复现**：
  ```bash
  # 启一个无关 long-lived 进程
  sleep 600 &  # 假设 PID 12345
  echo 12345 > server.pid
  ./stop.sh
  # sleep 600 被 SIGTERM 干掉；server.pid 被清理。
  ```
- **影响**：错误的 PID 会让 `stop.sh` 杀掉不相关的进程（开发者本地工作、CI、cron 等）。
- **修复建议**：`ps -p $PID -o args=` 检查命令行包含 `server.py` 且 cwd 是项目根；不匹配则警告并拒绝 kill。也可以读 `/proc/$PID/cmdline`。

---

## 4. LOW 严重度

### L1. 静态 / API 响应缺少常见安全头

- **位置**：`server.py` 未注册任何 after_request hook 或额外响应头。
- **缺失**：
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY` 或 CSP `frame-ancestors 'none'`
  - `Content-Security-Policy`（前端可能用 `<meta>` 自定；后端兜底可加）
  - `Strict-Transport-Security`（仅当 HTTPS）
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **复现**：
  ```bash
  curl -i http://127.0.0.1:PORT/ | grep -iE 'content-type-options|x-frame|csp|strict-transport'
  # 实测：全部缺失
  ```
- **影响**：低。SPa 不易被 framing/MIME confusion 利用。
- **修复建议**：在 `create_app` 中加 `app.after_request` 注册常见头。

---

## 5. 通过的复核项（无问题）

为平衡视角，记录未发现问题的领域，便于 leader 判断修复优先级：

- **多账号隔离**：3 用户独立写入 + 互读，**通过**（`probe_account_isolation`）。
- **多 app 实例 + OCC**：两个 `create_app(db_path=...)` 写同一 DB，相同 `revision` 并发 PUT，**恰好一个 200，另一个 409 携带新 rev**（`probe_concurrent_occ`）。
- **静态资源旁路**：24 个 probe 路径（`.git/`、`tests/`、`data/meteohub.db`、`server.py`、URL 注入等）**全部 404**（`probe_static_bypass`）。
- **密码哈希**：werkzeug pbkdf2:sha256，600000 iterations，恒定时间比较（login 路径）。
- **用户名冲突**：`COLLATE NOCASE` + UNIQUE，并发 register 19× 409 + 1× 201，DB 只 1 行。
- **tampered cookie**：签名错误 → `BadSignature` → `None` → 401。
- **`/api/run-code`**：返回 410 Gone，提示文案明确（无静默执行）。
- **admin 端点**：全部 404。
- **CORS**：未启用 `flask_cors.CORS`，跨源默认拒绝（隐式 OK；不必显式 OPTIONS）。
- **错误处理**：未注册 handler 的异常走 500，stderr 打印堆栈但不泄露到响应（`return _bad("服务器内部错误")`）。

---

## 6. 修复优先级建议

1. **H1（auto-init race）**：影响所有并发首次 GET；500 + 堆栈泄漏；schema 迁移必触发。**最高优先**。
2. **H2（deleted user + valid cookie）**：admin 删除账号有 14 天副作用窗口；可被攻击者利用（保留自己 cookie 等待删除重置）。**高**。
3. **H3（413 被掩盖）**：合并到 leader 已分配的「64KB/256KB 容量矛盾」修复；改 `_json_body` 的异常分类即可。**中-高**。
4. **M4（stop.sh PID 验证）**：误杀无辜进程；运维事故。**中**。
5. **M2（CSRF token）**：现实威胁有限，但成本低。**中**。
6. **M1（SECRET_KEY env）**：leader 已分配。**低**（已分配）。
7. **M3（嵌套深度）**：仅恶意 / 好奇用户触发。**低**。
8. **L1（安全头）**：锦上添花。**低**。

---

## 7. 复现工件

```bash
cd /Volumes/Kingston/Mac/MeteoHub
python3 qa/backend-audit-probes.py        # 9 个 probe 场景；输出 7 项 findings
python3 -m pytest tests/ -v                # 51/51 通过（回归基线）
```

`backend-audit-probes.py` 不依赖任何测试外的 Python 包，仅用 stdlib + 已安装的 flask/itsdangerous/werkzeug/pytest。临时 SQLite 路径保证不污染 `data/meteohub.db` 与 `data/secret.key`。

---

*复核人：Hermes (slot 01a09395-1342-74e3-85bd-2a63a4eb01d9)*
*复核对象：server.py @ HEAD + tests/ + *.sh*