# MeteoHub 后端工程审计 · 安全 + 工程扫描

> 由 Bastion (teammate) 完成扫描，只读不改代码；每条结论带 `文件:行号` 定位或函数/段落引用。
> 横向对照 `OPTIMIZATION_AUDIT.md` §C（C1-C5）、§F（不要动的事项）。
> 检索范围：server.py、tests/、qa/、README.md、HOW_TO_RUN.md、*.sh、package.json、requirements*.txt。
> 不可在 server.py / tests / qa 找到证据的，标注 **"待核"**。

---

## §1 现状速览

依据 `qa/verification.md`（行 7-15）：

- **后端 pytest：67 PASS**（`/opt/miniconda3/bin/python -m pytest tests/ -q`，行 9）。
- **DOM/Store 回归：12 PASS / 0 FAIL**（`bash qa/run-all.sh`，行 10）。
- **真实 Chrome：14 组流程通过、0 JavaScript 异常**（`node qa/browser-integration.cjs`，行 11）。
- **已加防护**：OCC（revision 自增 + 409 携带服务端 state，见 `server.py:563-663`）、timing-safe 登录（`server.py:494-502`）、CSP / X-Frame-Options / Referrer-Policy / X-Content-Type-Options（`server.py:330-342`）、Same-Origin 写入守卫（`server.py:348-374`）、状态深度上限 32（`server.py:828` + `_check_depth` 行 745-761）、cookie HttpOnly + SameSite=Lax（`server.py:837-841`）、secret.key 0600 写入（`server.py:152-155`）、签名 cookie 用 itsdangerous URLSafeTimedSerializer（`server.py:206-225`）、`SECRET_KEY` env > 文件 > 自动生成（`server.py:127-156`）。
- **代码体积**：server.py 866 行（已确认），单实例 Flask + SQLite 单文件 WAL 模式。
- **遗留**：app.js / workspace.js / styles.css 是 minify 产物，源码在 .orig（见 `OPTIMIZATION_AUDIT.md` §1 行 10 / §F）。

---

## §2 限流与防滥用

### §2.1 速率限制

- **`grep "limit|rate|throttle"` 在 server.py 全文**（命中 9 处，详见搜索结果）：
  - 行 27、30、67：注释和 import 行 `werkzeug.security`（无功能）。
  - 行 83、85：常量 `MAX_STATE_BYTES` / `MAX_JSON_BODY`（输入体积上限，**非速率**）。
  - 行 133：注释 `data/secret.key`（无关）。
  - 行 457：`generate_password_hash` 调用（无关）。
  - 行 748、826：注释 `_check_depth` 上限说明（无关）。
- **结论**：`/api/auth/login`、`/api/auth/register`、`/api/state PUT` 均**没有任何速率限制**。**没有 `limiter`、`@limiter.limit`、`IPBucket` 之类装饰器或中间件**。
  - 仅靠 `_db_lock`（`server.py:114`）序列化写——这是写入互斥，不是频次控制。
  - 没有失败计数、没有 IP 维度的滑动窗口、没有用户维度失败阈值。
  - 注释 `OPTIMIZATION_AUDIT.md` §C 行 48（C1）已记录：与本结论一致。

### §2.2 登录失败记录

- 失败响应：登录失败两次都返回 `_bad("用户名或密码错误", 401)`（`server.py:500, 502`）。
  - **不区分**"用户不存在" vs "密码错误"——返回同一文案，避免账号枚举。
- 是否记录失败次数：**无**。无 login_attempts 表、无内存计数器、无失败日志。
- 是否触发锁定：**无**。理论上无限次重试。

### §2.3 密码 hash

- 算法：**werkzeug 默认** `pbkdf2:sha256`，由 `generate_password_hash(password)` 调用（`server.py:457`）触发。
- 迭代次数：**默认 600000**（werkzeug 3.x 默认）。证据：`server.py:497` 显式构造一个 dummy 哈希字符串 `"pbkdf2:sha256:600000$dummy$" + "0"*64` 给"用户不存在"分支走 hash 校验——使用 600000 即默认值。
  - 注：若未来 werkzeug 改默认值，本字符串里的硬编码会**与运行时实际不一致**——潜在 timing 不一致问题，但目前是同步的（待核：需要看实际安装的 werkzeug 版本是否仍是 600000）。
- 是否单独验证过 hash 算法在 `_resolve_user`/OCC 等关键路径：**未涉及**（hash 只在 register/login 两处）。

---

## §3 输入校验

### §3.1 username 校验（`server.py:441-456`）

- 长度：`MAX_USERNAME = 64`（`server.py:90`）；下限 `len < 3`（行 449-450）。
- 类型：`isinstance(str)` 经 `_bounded_str`（行 291-298）。
- 字符集：`ch.isascii() and (ch.isalnum() or ch in "_-")`（行 454-456）。
  - **允许**：ASCII 字母、数字、`_`、`-`。
  - **拒绝**：非 ASCII、控制字符、Unicode 空格、emoji、空字符串、全空白（`username.strip()` 后再判长度，行 447 / 449）。
  - **会拒掉的边界**：包含 `\t`、`\n`、空格、`@`、`.`、中文、空格。
- **测试覆盖**：`test_register_rejects_bad_username_charset`（`test_auth.py:37-39` 验证 `@` 被拒）；`test_register_rejects_short_username_and_password`（行 32-34）；`test_register_rejects_oversized_username`（行 56-58）。
- **结论**：用户名校验**严格**，控制字符被 `isascii()` 间接拒绝。无明显绕过。

### §3.2 state payload 校验

- 顶层字段枚举（`server.py:731-780`）：`publications / questions / researchers / following / bookmarks / profile / pages / projects`——八个键必须全部存在（`_is_valid_state` 行 767-770）。
- 类型校验：除 `profile` 必须是 dict 外，其他 7 个键必须是 list（行 771-776）。
- 嵌套深度：`MAX_STATE_DEPTH = 32`（`server.py:828`），由 `_check_depth`（行 745-761）递归检查。
- 体积上限：
  - `MAX_STATE_BYTES = 2 * 1024 * 1024`（2 MiB，`server.py:88`），按 UTF-8 实际字节算（`server.py:591-596` 用 `serialized.encode("utf-8")` 而非 `len(serialized)`）。
  - `MAX_JSON_BODY = MAX_STATE_BYTES + 16 * 1024`（2 MiB + 16 KiB envelope，`server.py:89`）。
- 其他字段（`revision`）：必须是非负整数，**显式拒绝** `bool`（`server.py:585`：`isinstance(rev, int) or isinstance(rev, bool) or rev < 0`）。
- **测试覆盖**：`test_state_put_rejects_excessive_depth`（`test_race_and_security.py:193-204` 100 层 → 400）；`test_state_put_accepts_normal_depth`（行 207-218 10 层 → 200）；`test_put_state_64kib_chinese_utf8`（`test_size_and_secret.py:38-62`）；`test_put_state_rejects_above_state_cap`（行 65-79）。

### §3.3 DOI / ORCID 等正则

- **客户端**（`app.js.orig` 行 24-25、488-497）：
  - `DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i`
  - `ORCID_REGEX = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/`
- **服务端**：`grep -i "doi|orcid" server.py` —— **无任何服务端校验**。DOI/ORCID 字段保存在 `state.publications[].doi` / `state.researchers[].orcid` 内，但 `_is_valid_state`（`server.py:764-780`）不深入校验嵌套对象内的字段。
- **结论**：DOI/ORCID 完全靠前端校验。如果绕过浏览器直接 PUT 任意 state，可注入任意格式字符串。
  - **风险等级**：中。攻击面需要先登录拿到 cookie，再 PUT 自己的 state——影响限于自身账户可显示什么内容。但若前端 `escapeHtml` 在某条渲染路径遗漏，XSS 风险存在。**待核** `app.js.orig` 内所有 `doi`/`orcid` 渲染点是否都过 `escapeHtml`（已知 `escapeHtml` 在行 634/727/751/900/930 使用）。

---

## §4 会话与 cookie

### §4.1 签名 cookie 实现（`server.py:206-225`）

- 库：`itsdangerous.URLSafeTimedSerializer`。
- **salt = `"meteohub-session"`**（`server.py:209, 218`）——硬编码，全局唯一。
- **max_age = `SESSION_MAX_AGE = 60 * 60 * 24 * 14`** = 14 天（`server.py:93, 219`）。
- secret_key 来自 `_get_secret_key()`（`server.py:127-156`）。
- 容错：`BadSignature` 与其它异常都返回 None（`server.py:222-225`），不向上抛。

### §4.2 secret_key 解析顺序（`server.py:140-156`）

- 1️⃣ `os.environ["SECRET_KEY"].strip()` 非空 → 用环境变量。
- 2️⃣ 文件 `data/secret.key`（路径常量 `SECRET_FILE`，行 81）存在且非空 → 读出来。
- 3️⃣ 都没有 → `uuid.uuid4().hex + uuid.uuid4().hex`（32 字节十六进制 ×2 = 64 hex 字符 = 32 字节熵），写入文件并 `chmod 0o600`（行 152-155）。
- 文件权限：**尽力 chmod 0600，OSError 静默吞掉**（行 152-155）——Windows 不支持 chmod 时静默退化为默认权限，**安全降级但有提示缺失**（行 154 `except OSError: pass`）。
- **测试覆盖**：`test_secret_key_env_takes_precedence` / `env_strips_whitespace` / `falls_back_to_file_when_env_empty` / `generates_when_neither`（`test_size_and_secret.py:126-183`）。
- **结论**：解析顺序与权限处理已锁。**待核**点：Windows / 网络文件系统下 0600 是否生效（OSError 静默处理未记录告警）。

### §4.3 cookie 属性（`server.py:831-841`）

```python
resp.set_cookie(
    SESSION_COOKIE_NAME, token,
    max_age=SESSION_MAX_AGE,
    httponly=True,
    samesite="Lax",
    secure=False,  # ← 硬编码 False，注释说"生产 HTTPS 时设 True"
    path="/",
)
```

- `HttpOnly = True` ✓
- `SameSite = "Lax"` ✓
- **`secure = False` 硬编码** —— 生产 HTTPS 部署前**必须**改代码或加运行时切换。注释（行 839）写了"set True when serving over HTTPS in production"，但**没有自动判断 `request.is_secure` 或环境变量**。
- 没有 `domain` 显式设置 → 默认 host-only（正确）。
- **测试**：`test_register_returns_user_and_session_cookie`（`test_auth.py:13-22`）断言 HttpOnly 和 SameSite=Lax；**没有测 secure 标志**（因为它恒为 False）。

---

## §5 安全头与 CSP

### §5.1 after_request 设置（`server.py:330-342`）

| Header | 值 | 来源 |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | 行 332 |
| `X-Frame-Options` | `DENY` | 行 333 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 行 334 |
| `Content-Security-Policy` | 见 §5.2 | 行 335-341 |

- 用 `setdefault`——**测试或未来代码若设同名 header 不会被覆盖**。

### §5.2 CSP（`server.py:336-340`）

```
default-src 'self';
img-src 'self' data:;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
script-src 'self';
connect-src 'self';
frame-ancestors 'none'
```

- 覆盖：`default-src` / `img-src` / `style-src` / `font-src` / `script-src` / `connect-src` / `frame-ancestors` 全在。
- **缺**：`object-src`、`base-uri`、`form-action`、`media-src`、`worker-src`—— 全部回退到 `default-src 'self'`，所以等于全禁。安全但不显式。
- **过宽处**：`style-src 'unsafe-inline'`——为了支持现有内联 `<style>` 块。**待核**：是否真的需要；若不需要建议加 nonce/hash。
- **过严处**：`connect-src 'self'`——只允许同源 XHR/fetch；前端如果用 SSE 或 CDN 远程 API 会失败。当前未使用（前端所有 fetch 都打 `/api/*`）。
- **测试**：`test_security_headers_present`（`test_race_and_security.py:273-282`）断言 `default-src 'self'` 和 `frame-ancestors 'none'` 在。

### §5.3 其它

- `X-Frame-Options: DENY` ✓（与 CSP `frame-ancestors 'none'` 双保险）。
- `Referrer-Policy: strict-origin-when-cross-origin` ✓（现代合理默认）。
- 没有 `Strict-Transport-Security`（HSTS）—— 因为默认非 HTTPS，HSTS 不可加；但 HTTPS 部署后**应追加**（待核）。

---

## §6 同源校验（CSRF）

### §6.1 `_guard_origin`（`server.py:348-374`）

- 触发条件：仅 `request.method ∈ {"POST", "PUT", "PATCH", "DELETE"}`（`_WRITE_METHODS` 行 348，行 352）。
- 范围：仅 `/api/*` 路径（行 355）——静态 GET 完全豁免。
- **Origin 缺失**：返回 None（允许）——非浏览器客户端（curl、服务端 fetch）不被拦（行 358-362）。
  - 注释解释：SameSite=Lax cookie 已挡住浏览器跨站 POST，这是 defense-in-depth。
- Origin 解析失败：返回 403 `_bad("Origin 校验失败", 403)`（行 367-369）。
- 允许列表：`{request.host.split(":")[0], "127.0.0.1", "localhost", HOST}`（`server.py:371`）。
  - 注意 `HOST` 是模块启动时常量（行 78 = `127.0.0.1`）——如果生产部署用 `0.0.0.0` 监听，Origin 应允许任意外部 host 来访——但 `request.host` 已经覆盖了实际访问 host。
- 失败响应：`_bad("跨源写入被拒绝", 403)`（行 373）。

### §6.2 豁免

- 所有 GET（无论 `/api/*` 还是 `/static/*`）。
- 所有非 `/api/*` 写路径——但实际上当前**没有**非 `/api/*` 写端点。
- 缺 Origin 头的写请求（curl / 服务端）。
- 同源 Origin 头（`request.host`、`127.0.0.1`、`localhost`、启动 HOST）。

### §6.3 测试

- `test_cross_origin_write_is_rejected`（`test_race_and_security.py:226-233`）evil.example.com → 403。
- `test_same_origin_write_passes`（行 236-243）。
- `test_no_origin_header_passes_for_write`（行 246-252）—— 确认 curl 不被误伤。
- `test_get_endpoints_ignore_origin`（行 255-265）—— GET 即使 evil origin 仍 200。

### §6.4 评估

- 实现完整。**唯一边界**：`request.host` 包含端口——`_guard_origin` 截掉端口（`request.host.split(":")[0].lower()`，行 370），但允许列表里的 `"127.0.0.1"` / `"localhost"` 不含端口，逻辑一致。
- **缺口**：未覆盖 `Sec-Fetch-Site`（浏览器自带），不需要。
- **待核**：若将来加 PATCH/DELETE 端点，Origin 守卫自动覆盖；当前 `_WRITE_METHODS` 已枚举。

---

## §7 数据库与并发

### §7.1 Schema 索引（`server.py:159-179`）

| 表 | 现有索引 | 缺什么 |
|---|---|---|
| `users` | `id PRIMARY KEY AUTOINCREMENT`、`username UNIQUE COLLATE NOCASE` | `created_at` 无索引（但只有 ORDER BY 时才需要） |
| `state` | `user_id PRIMARY KEY`（隐含索引）、无 `revision` 索引 | `revision` 不在 WHERE；可省 |
| `code_runs` | `id PRIMARY KEY AUTOINCREMENT` | **`at` 无索引**——`COUNT(*)` 全表扫，行 271-275 |

- **`code_runs.at` 索引缺失**——已被 `OPTIMIZATION_AUDIT.md` §C3（行 50）标注为 P2。当前数据量小无影响，但加 `CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)` 零成本。
- `state.payload` 是 TEXT，`state.revision` 没有独立索引——只按 `user_id` 查询，不需要。
- 外键：`state.user_id REFERENCES users(id) ON DELETE CASCADE`（行 172），通过 PRAGMA 启用（行 187）。

### §7.2 锁 / 连接（`server.py:114, 182-193`）

- `_db_lock = threading.Lock()`（行 114）——**进程内互斥**。
  - 颗粒度：覆盖 `init_db`（行 197）、`register`（行 459）、`state_get`（行 539）、`state_put`（行 598）、`bump_code_runs`（行 263）。
  - **未覆盖**：`_resolve_user`（行 818）、`me`（行 518-524）、`active_count`（行 254-258，用独立 `_active_lock`，行 237）、`code_runs_total`（行 269-275）。
  - `_resolve_user` 只做 `SELECT 1` + `me` 只读——并发安全，但**如果别处并发 DELETE FROM users**，可能导致 state_get 拿到 stale uid（仍走 `_resolve_user` 兜底）。
- `db_conn()`（行 182-193）：
  - `timeout=10` ✓（行 185）——避免无界等待。
  - `isolation_level=None`（autocommit，行 185）——手动管理事务。
  - **PRAGMA**：`foreign_keys=ON`（行 187）、`journal_mode=WAL`（行 188）、`synchronous=NORMAL`（行 189）。
  - **缺**：`busy_timeout` PRAGMA（虽然 `timeout=10` 已设）；`cache_size`、`temp_store=MEMORY`（性能可调）。
  - **待核**：`mmap_size` 未设。

### §7.3 事务边界

- `register`（`server.py:459-471`）：
  - 在 `_db_lock + db_conn()` 块里依次：
    1. `INSERT INTO users`（行 461-464）
    2. `INSERT INTO state(user_id, 0, _empty_state_json(), now)`（行 468-471）
  - **`isolation_level=None` + 无显式 BEGIN/COMMIT**——SQLite 的 INSERT 单语句原子，但**两个连续 INSERT 在不同语句**，若进程在 1 后 2 前崩溃 → 用户行存在但 state 行缺失。
  - 该用户下次 `state_get`（行 543-554）会 `INSERT OR IGNORE` 兜底——所以**幂等自愈**。
  - **结论**：register 不是严格两阶段提交，但幂等性保证了最终一致性，OK。
- `state_put`（`server.py:598-662`）：见 §7.4 OCC。
- `login`（`server.py:489-493`）：单 SELECT，不写。
- `bump_code_runs`（`server.py:261-266`）：单 INSERT，外层 `try/except OperationalError`。

### §7.4 OCC（Optimistic Concurrency Control）

完整路径（`server.py:563-663`）：

1. **SELECT revision, payload**（行 599-601）。
2. 若 row 为空（首次 PUT）→ `INSERT OR IGNORE(uid, 1, serialized, now)`（行 606-610）→ 再 SELECT（行 612-614）。
   - 如果自己刚写且与 serialized 匹配 → 直接返回 `{state, revision: 1}`（行 615-616）。
   - 否则（别人先写了）→ 落入下面正常 OCC 分支。
3. **比 revision**（行 622-637）：若 `current_rev != rev` → 返回 409 携带服务端 state。
4. **UPDATE WHERE revision = current_rev**（行 638-643）→ 新 revision。
5. **`conn.total_changes == 0` 兜底**（行 644-662）：UPDATE 没改任何行 → SELECT 当前 state → 返回 409。

**race 覆盖评估**：
- ✓ 同用户并发 PUT（不同 revision）：两条都进 SELECT 阶段拿到相同 revision → UPDATE 阶段第一个赢，第二个 `total_changes == 0` → 409。
- ✓ 同用户并发首次 PUT：两个都走 `INSERT OR IGNORE`——SQLite 保证只有一个真插入，另一个被 IGNORE 跳过。然后 SELECT 会看到第一个的写入，落到 OCC 分支：自己持有的 serialized 与 DB 不一致 → 不会触发 "row2 == serialized" 早退（行 615），落到 OCC 比 revision → 409。
- ✓ `state_get` 并发首次：`INSERT OR IGNORE` 模式（行 547-551）。
- **测试覆盖**：
  - `test_state_get_concurrent_first_gets_no_500`（`test_race_and_security.py:42-77`，30 线程）。
  - `test_state_put_concurrent_first_puts_no_500`（行 80-114，20 线程，断言所有响应 200 或 409）。
- **结论**：OCC 路径**完整覆盖**已知竞态。

---

## §8 静态文件与代码暴露

### §8.1 STATIC_ALLOWLIST（`server.py:96-106`）

```
"" (→ index.html)
index.html
styles.css
workspace.css
app.js
workspace.js
favicon.ico
favicon.svg
manifest.json
```

### §8.2 STATIC_ASSET_PREFIXES（`server.py:107`）

```
("assets/", "img/")
```

### §8.3 静态文件路由（`server.py:383-431`）

- 路径遍历检查（行 386-392）：
  - `filename == ""` → 404。
  - `filename.startswith("/")` → 404。
  - `"\\" in filename` → 404。
  - `".." in filename.split("/")` → 404。
- assets/img 前缀额外挡扩展名（行 399-404）：`.py / .db / .db-journal / .db-wal / .db-shm / .log / .key / .env / .sqlite / .sqlite3`。
- 解析路径再校验 `startswith(BASE_DIR + os.sep)`（行 407-409、414-416）——二次防穿越。
- forbidden 列表（行 419-430）：`server.py / requirements.txt / HOW_TO_RUN.md / README.md / LICENSE / .env / .git / .gitignore`；后缀 `.py / .db* / .log / .key`；`tests/` 前缀；`tests` 本身。
- 默认 Flask `static` 路由已被替换为 404（`server.py:317-322`）。

### §8.4 评估

- **覆盖完整**：源码、数据库、日志、密钥、git、测试目录全部 404。
- **双层防御**：`split("/")` 检查 `..` + `normpath + startswith(BASE_DIR)` 二次校验。
- **路径归一化**：Windows 用 `os.sep`（"\\"）——但 Flask URL 路径一般是 POSIX 风格 `/`，行 389 的 `"\\" in filename` 是为了防御非常规输入。
- **唯一待核**：`send_from_directory(BASE_DIR, filename)`（行 410、416）是否在 `filename` 包含 NUL 字符（`\x00`）时报错？werkzeug 的 `send_from_directory` 会抛 BadRequest。**待核**具体行为，但默认安全。

### §8.5 测试覆盖（`test_static_and_legacy.py`）

- `test_server_py_is_blocked`（行 20-22）
- `test_assets_folder_blocks_dangerous_extensions`（行 25-50）——验证 `assets/server.py` 被挡。
- `test_flask_default_static_route_is_disabled`（行 53-63）—— `/static/...` 一律 404。
- `test_requirements_txt_is_blocked`（行 66-68）
- `test_git_directory_is_blocked`（行 71-74）
- `test_database_files_are_blocked`（行 77-81）
- `test_log_files_are_blocked`（行 84-86）
- `test_tests_directory_is_blocked`（行 89-92）
- `test_path_traversal_blocked`（行 95-99）

**结论**：静态白名单/黑名单 + 路径穿越 + assets 二次过滤全部测试覆盖。

---

## §9 错误处理与日志

### §9.1 errorhandler（`server.py:702-722`）

| Status | Handler | 行为 | 是否泄漏栈 |
|---|---|---|---|
| 404 | `not_found`（行 702-706） | `/api/*` → `_bad("接口不存在", 404)`；否则 → `_bad("资源不存在", 404)` | 否 |
| 405 | `method_not_allowed`（行 708-710） | `_bad("方法不被允许", 405)` | 否 |
| 413 | `too_large`（行 712-714） | `_bad("请求体过大", 413)` | 否 |
| 500 | `server_error`（行 716-722） | `traceback.print_exc()` 到 stderr + 返回 `_bad("服务器内部错误", 500)` | 否（响应不带栈） |

- 所有响应都走 `_bad(msg, code)`（`server.py:283-284`）→ `make_response(jsonify({"error": msg}), code)`——**统一 JSON 错误体**，**绝不泄漏堆栈或异常类名**。
- **栈输出**：`traceback.print_exc()`（行 719）打到 **stderr**。`app.run()` 默认会把 stderr 写到终端——`HOW_TO_RUN.md` 行 37 提到"后台模式创建 `server.pid`、`server.log`"，但 server.py 没用 Flask logger，而是直接 print 到 stderr。
  - **待核**：`server.log` 实际如何产生？可能是 `run-background.sh` 重定向，未确认。

### §9.2 5xx 路径日志

- **没有调用 `app.logger.exception()`**（`grep "app.logger|logger\.|logging\." server.py` 0 命中）。
- 5xx 路径**只**用 `traceback.print_exc()`（行 719）——格式为 Python 默认 traceback，不带 timestamp / request path / user id。
- `bump_code_runs` 的 `OperationalError` 静默吞掉（行 265-266）——不记录也不告警。

### §9.3 `/api/run-code` 410 gone（`server.py:684-691`）

- 返回 410 + `_bad("服务器端代码执行功能已下线。…", 410)`（行 687-691）。
- **同时**调用 `bump_code_runs()`（行 686）——**仍然写 `code_runs` 表**，让 `/api/code-runs` 计数器对老客户端持续推进。
- 设计意图：**保留计数兼容 + 明确拒绝**。不是占位。
- **测试**：`test_run_code_endpoint_returns_410_with_clear_message`（`test_static_and_legacy.py:102-108`）。

### §9.4 评估

- 错误处理整体专业、统一 JSON、无栈泄漏。
- **缺口**：日志缺结构化字段（timestamp、path、method、user_id）和 logger 抽象。

---

## §10 已废弃端点

### §10.1 路由声明（`server.py:684-697`）

```python
@app.route("/api/run-code", methods=["POST", "GET"])
def api_run_code_gone():       → 410 + 调用 bump_code_runs
@app.route("/api/admin/stats", methods=["GET"])
@app.route("/api/admin/clear-history", methods=["POST"])
@app.route("/api/code-history", methods=["GET"])
def api_admin_gone():          → 404
```

- `/api/run-code`：**410 Gone**（不是 404）—— 明确告知"曾存在、已下线"。
- `/api/admin/stats`、`/api/admin/clear-history`、`/api/code-history`：**404**（统一 `_bad("管理端点已下线", 404)`）。
- **测试**：`test_admin_endpoints_gone`（`test_static_and_legacy.py:111-114`）。
- **安全意义**：admin 端点不存在 → 不可被猜到 URL 触发管理功能。设计正确。

---

## §11 测试覆盖观察

### §11.1 各文件覆盖盘点

| 测试文件 | 主要场景 | 关键覆盖 |
|---|---|---|
| `test_auth.py`（142 行） | register/login/logout/me/cookie | 短用户名/密码、字符集 `@` 被拒、超长、缺失字段、非 string、duplicate 409、`Set-Cookie` 含 HttpOnly + SameSite=Lax、tampered cookie 拒 |
| `test_state.py`（164 行） | GET/PUT state、409 conflict、per-user 隔离 | revision 自增、409 携带服务端 state、缺顶层键、错类型、profile 非 dict、revision 非整数/负、用户隔离、模拟重启保留 |
| `test_race_and_security.py`（282 行） | 并发 + 安全 | 30 线程 first GET、20 线程 first PUT、H2 deleted-user 401、H3 413 不被吞、depth >32 拒、depth ≤32 过、cross-origin 403、same-origin 200、no-origin 200、GET 忽略 origin、安全头全在 |
| `test_size_and_secret.py`（183 行） | 容量 + secret 解析 | 64 KiB 中文 UTF-8、超 MAX_STATE_BYTES 拒、~80% 过、超 MAX_JSON_BODY 兜底、SECRET_KEY env > 文件 > 生成、env strip、env 空 fallback |
| `test_static_and_legacy.py`（138 行） | 静态白名单 + 旧端点 | index 200、styles/app/workspace 200/404、server.py 404、assets/.py 404、/static/ 404、requirements.txt 404、.git 404、.db* 404、server.log 404、tests/ 404、path traversal 不 200、/api/run-code 410 含"已下线"、admin 404、code-runs/active-count 匿名 |
| `test_app_isolation.py`（25 行） | 多 Flask 实例库隔离 | 两个实例各自 create_app 写不同库；`DB_PATH` 模块常量不被改 |
| `test_stop_script.py`（24 行） | stop.sh cwd 校验 | 别的目录同名 `server.py` PID 不被误杀 |

### §11.2 空白 / 未覆盖场景

| 空白 | 风险 | 位置建议 |
|---|---|---|
| **限流 / 暴力破解** | 高 | 引入 C1 后需 `test_rate_limit.py`；当前无对应路径可测 |
| **密码 hash 算法版本** | 低 | 没测 `password_hash` 实际格式是 `pbkdf2:sha256:600000$` |
| **空字符串密码** | 低 | `test_register_rejects_short_username_and_password` 测 `len < 6`；空字符串会 `len==0` 触发 `_bounded_str` "不能为空" |
| **登录连续失败 N 次后锁定** | — | 当前无锁定机制，自然无测试 |
| **大文件下载攻击** | 低 | 静态白名单没有"任意大文件"风险（只允许 9 个文件 + assets/img）；`MAX_CONTENT_LENGTH` 限制 JSON 体 |
| **Cookie 过期边界** | 中 | `SESSION_MAX_AGE = 14d`——max_age 是 itsdangerous 的 Token 验证项，14 天后的 cookie 自动 401。但**没有显式测试**：mint 一个 max_age=0 的 cookie、再 put/get state 验证 401。 |
| **登录 user 表被 LOCK 后** | 低 | `_db_lock` 序列化；sqlite 是单文件，无多进程锁 |
| **CSS / JS 内容的 `escapeHtml` 覆盖** | 中 | 仅有 `qa/test-05-export-xss-projects.js`（在 qa/，未详查）；建议后端加一个测：state 里塞 `<script>alert(1)</script>` 进 profile.name，GET 后断言 JSON 转义 |
| **dev-server threaded=True 下的 race** | 低 | threaded=True 是默认；测试已覆盖 30/20 线程 |
| **`Origin: null` 头** | 低 | 当前浏览器对 `data:`/`file:` 发送 Origin: null，`urlparse` 不报错，`o.hostname` 为空 → 行 369 拒绝。需要明确测 `Origin: null` |
| **HEAD / OPTIONS 写方法** | 低 | OPTIONS 不会被 `_WRITE_METHODS` 拦截（行 348 只列 POST/PUT/PATCH/DELETE）；OPTIONS 不写，无碍 |

---

## §12 优先级清单

按风险等级排序；每条都标注文件:行号 + 验证手段。

| # | 等级 | 描述 | 行号 | 建议 | 验证手段 |
|---|---|---|---|---|---|
| P0-1 | **P0** | `/api/auth/login`、`/api/auth/register`、`PUT /api/state` 无任何速率限制；登录失败无计数 / 无锁定。攻击者可暴力枚举 | `server.py:436-505, 563-663`；`OPTIMIZATION_AUDIT.md` §C C1（行 48） | 内存滑动窗口限流：login/register 5 次/分钟/IP，state PUT 30 次/分钟/IP；IP 取 `request.remote_addr` 或 `X-Forwarded-For`（需 `TRUST_PROXY=1` 显式开启） | 新增 `tests/test_rate_limit.py`：第 6 次同 IP login 返回 429；不同 IP 不串扰；`TRUST_PROXY=1` 时 `X-Forwarded-For` 生效 |
| P0-2 | **P0** | cookie `secure=False` 硬编码（`server.py:839`）；HTTPS 部署若忘记改代码 → cookie 走明文 | `server.py:831-841` | 改为 `if request.is_secure or os.environ.get("SESSION_COOKIE_SECURE") == "1": secure=True`，否则保持 False；改后单元测试断言 HTTPS 模拟下 secure=True | `tests/test_size_and_secret.py` 新增测试：`environ={"SESSION_COOKIE_SECURE":"1"}` 时 `secure` 标志位 = True |
| P0-3 | **P0** | 5xx 路径未使用 Flask logger，traceback 仅打到 stderr；`server.log` 是否含 traceback 待核 | `server.py:716-722`；`HOW_TO_RUN.md` 行 37 | 改为 `current_app.logger.exception("500 at %s %s", request.method, request.path)`，并改 `run-background.sh` 把 stderr 重定向到 `server.log`（已写但待核：实测日志文件是否包含栈） | 注入异常路径，验证 `server.log` 含 traceback；验证响应体仍只有 `{"error":"服务器内部错误"}` |
| P1-1 | **P1** | `style-src 'unsafe-inline'` 全开——任意内联 `<style>`/`<style attr>` 都能跑。XSS 一旦有注入面立即放大 | `server.py:337-340` | 渐进收紧：先扫 index.html 找出内联 style，改成外部或加 nonce；再 `'unsafe-inline'` 换 nonce-source | 跑 `qa/test-05-export-xss-projects.js`；新增 `tests/test_security_headers.py` 断言 CSP 无 `'unsafe-inline'` |
| P1-2 | **P1** | DOI / ORCID 等用户字段**无服务端校验**；信任前端正则 | `app.js.orig:24-25, 488-497`；`server.py:_is_valid_state` 行 764-780 | 在 `state_put` 入口加 server-side `validate_doi(state.get("publications",[]))` 和 `validate_orcid(state.get("researchers",[]))`，复用前端正则 | `tests/test_state.py` 新增：PUT state 里塞 `doi:"<script>..."` → 400；合法 DOI/ORCID 仍 200 |
| P1-3 | **P1** | `code_runs.at` 无索引——`COUNT(*)` 全表扫；当前表小无影响 | `server.py:175-178, 269-275`；`OPTIMIZATION_AUDIT.md` §C C3（行 50） | SCHEMA 末尾加 `CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)`；迁移友好 | 新增 `tests/test_size_and_secret.py::test_code_runs_index_exists`：连 DB 查 `sqlite_master` |
| P1-4 | **P1** | `secret.key` chmod 0600 在 Windows / 非 POSIX 文件系统下静默 `OSError: pass`（`server.py:152-155`）—— 安全降级无告警 | `server.py:152-155` | 捕获 OSError 后用 `app.logger.warning("secret.key chmod 0600 failed: %s", e)` 记录；运营侧监控该警告 | 单元测试模拟 OSError，断言日志被记录 |
| P1-5 | **P1** | session 过期边界（`SESSION_MAX_AGE = 14d`）未测——若 itsdangerous 升级改了 max_age 语义可能静默出错 | `server.py:93, 219` | 新增测试：mint cookie + time.sleep(过 14d) → /api/state 401；mint cookie 内部 `max_age=0` → 401 | `tests/test_size_and_secret.py::test_session_max_age_enforced` |
| P2-1 | **P2** | `_db_lock` 不覆盖 `_resolve_user`（`server.py:818`）、`me`（行 518-524）—— 读路径无锁；若别处并发 `DELETE FROM users`，可能短暂 stale uid | `server.py:114, 818` | 把读路径也加 `_db_lock`，或接受最终一致性（前端 me 不写） | `tests/test_race_and_security.py::test_resolve_user_under_concurrent_delete` |
| P2-2 | **P2** | `Origin: null` 头（来自 `data:` / `file:` / sandbox iframe）走 `urlparse` → `o.hostname == ""` → 403（`server.py:368-369`）；当前未测 | `server.py:357-374` | 单元测试覆盖：`Origin: null` → 403；并文档化为何拒绝（防止 sandboxed iframe CSRF） | `tests/test_race_and_security.py::test_origin_null_rejected` |
| P2-3 | **P2** | CSP 缺 `object-src`、`base-uri`、`form-action` 显式声明——回退到 `default-src 'self'`，等于全禁，但不显式 | `server.py:336-340` | 补全：`object-src 'none'; base-uri 'self'; form-action 'self'`，文档化策略 | `tests/test_security_headers.py` 断言四个指令都在 |
| P2-4 | **P2** | `SECRET_KEY` 默认 64 hex 字符 = 32 字节熵（`server.py:149`）；够用但没区分"开发/生产"——`SECRET_KEY=` 未设即落文件 | `server.py:127-156`；README 行 43 | README 增补"首次部署必须显式 export SECRET_KEY"；启动时若文件刚生成则打 INFO 日志 | `tests/test_size_and_secret.py::test_secret_key_first_boot_warning` |
| P2-5 | **P2** | 登录失败响应已统一文案，但**未在错误日志里记录失败次数**——运营不可观测 | `server.py:500, 502` | 加内存滑动计数器：同一 username 5 次失败/15 分钟 → 401 + 响应头 `Retry-After: 60`；并发计数锁 `_login_attempt_lock` | `tests/test_rate_limit.py::test_login_lockout_after_5_failures` |

**P0 / P1 / P2 数量**：P0 = 3 条、P1 = 5 条、P2 = 5 条。

---

## §13 不要动的事项（与 `OPTIMIZATION_AUDIT.md` §F 对齐）

> 任何修改这些都必须先备份 `qa/verification.md` 通过基线并新增回归测试。

1. **API 契约**：`/api/auth/*`、`/api/state` GET/PUT（含 401/409/revision 自增）、`/api/active-count`、`/api/code-runs`、`/api/track-active` —— README.md 行 49-53 + verification.md 已锁。
2. **`/api/run-code` 必须保持 410 Gone**（verification.md "原 Python→JS 动态执行器已移除"）；admin 端点保持 404；`server.py:684-697` 已实现，`test_static_and_legacy.py:102-114` 已锁。
3. **OCC 行为**：`INSERT OR IGNORE → SELECT → UPDATE WHERE revision=current_rev → total_changes==0 fallback`（`server.py:563-663`）；`test_state.py` + `test_race_and_security.py:42-114` 已锁。
4. **CSP / Origin 校验 / X-Frame-Options**（`server.py:330-342, 348-374`）—— 不允许弱化。
5. **stop.sh 的 cwd + cmdline 双重校验**（`test_stop_script.py:8-24`）—— 不允许简化。
6. **secret.key 隔离**（`tests/conftest.py:17-21`）—— 不允许在测试里覆盖真实安装密钥。
7. **旧数据迁移只跑一次**：旧 `meteohub_users` / `meteohub_articles` / `meteohub_friends` 合入逻辑（在 app.js.orig 内），保留原键不删，密码不迁移 —— 不允许改。
8. **anonymous counters 不暴露用户**：`code_runs` 只记时间戳，无 user_id（`server.py:175-178`）；`active_count` 用随机 UUID key（`server.py:244`）；`test_static_and_legacy.py:117-138` 已锁。
9. **session cookie HttpOnly + SameSite=Lax**（`server.py:837-841`）；`test_auth.py:13-22` 已锁。`secure=False` 是已知项，但生产切换需按 P0-2 走而不是删除该行。
10. **`_db_lock` 全局进程内互斥**（`server.py:114`）—— 不要换成细粒度锁（事务边界会复杂化）；P2-1 的修复方式是"加锁覆盖更多路径"而非"换锁策略"。

---

## 附录 A · 关键行号速查

| 关注点 | server.py 行号 |
|---|---|
| 入口 / 模块常量 | 74-107 |
| secret key 解析 | 127-156 |
| schema / 索引 | 159-179 |
| `db_conn` PRAGMA | 182-193 |
| session cookie 签名 | 206-225 |
| active_count / code_runs | 237-275 |
| security headers (CSP 等) | 330-342 |
| `_guard_origin` | 348-374 |
| 静态文件白名单 | 383-431 |
| `/api/auth/register` | 436-474 |
| `/api/auth/login` | 476-505 |
| `/api/auth/logout` / `me` | 507-524 |
| `GET /api/state` | 529-561 |
| `PUT /api/state`（OCC） | 563-663 |
| `/api/active-count` / `/api/track-active` / `/api/code-runs` | 668-679 |
| `/api/run-code` 410 | 684-691 |
| admin 404 | 693-697 |
| errorhandler 404/405/413/500 | 702-722 |
| `_STATE_TOP_LEVEL` | 731-734 |
| `_empty_state` / `_empty_state_json` | 737-742 |
| `_check_depth` / `MAX_STATE_DEPTH` | 745-761, 828 |
| `_is_valid_state` | 764-780 |
| `_json_body` | 783-810 |
| `_resolve_user` | 813-822 |
| `_set_session_cookie` | 831-841 |
| entrypoint | 848-866 |

---

*报告路径：`/Volumes/Kingston/Mac/MeteoHub/SECURITY_AUDIT_BACKEND.md`*
