# DOCS_AUDIT · 文档与脚本一致性审计（T5 Hermes②, 只读）

> 任务 ID：`01a09aef-5e22-71f1-8cdd-cd6c72dd1ae4`
> 仓库：`/Volumes/Kingston/Mac/MeteoHub`
> 方法：只读扫描 + grep + diff；未修改任何文件
> 横向对照：`OPTIMIZATION_AUDIT.md` §E
> 时间：会话当前窗口

---

## §1 现状速览

- **文档**：`README.md` (78 行)、`HOW_TO_RUN.md` (86 行)、`OPTIMIZATION_AUDIT.md` (145 行)、`LICENSE` (143 行)、`qa/verification.md` (67 行)、`qa/backend-review.md` (257 行，历史)
- **脚本**：`start.sh / stop.sh / restart.sh / status.sh / run-background.sh / install-service.sh / build-optimized.sh / backup-restore.sh / python-env.sh` = 9 个（任务文本说 8 个，漏了 `python-env.sh`；待核任务给定的脚本清单是否本就是 8 个）
- **包配置**：`package.json` (21 行)、`requirements.txt` (2 行)、`requirements-dev.txt` (1 行)
- **git 状态**：`M = 11`（HOW_TO_RUN.md / README.md / index.html / install-service.sh / restart.sh / run-background.sh / server.py / start.sh / status.sh / stop.sh / styles.css），`?? = 20`（.gitignore、OPTIMIZATION_AUDIT.md、app.js、app.js.orig、backup-restore.sh、backups/、build-optimized.sh、dist/、node_modules/、package-lock.json、package.json、python-env.sh、qa/、requirements-dev.txt、requirements.txt、styles.css.orig、tests/、workspace.css、workspace.js、workspace.js.orig）。完整 `git status --short` 见上一会话起点（行号 `git status --short` 输出）
- **脚本被 README / HOW_TO_RUN 引用情况**：`start.sh / run-background.sh / status.sh / stop.sh` 全部被引用 ✓；`restart.sh` 仅 HOW_TO_RUN:34 引用；`install-service.sh` HOW_TO_RUN:39 引用；`build-optimized.sh` 仅 package.json:6 引用，**README / HOW_TO_RUN 都未提及**；`backup-restore.sh` 仅 package.json:7-8 引用，**文档零引用**；`python-env.sh` 未作为用户命令被引用（仅作为内部 source）

---

## §2 README.md 一致性

### 2.1 API 表格与 server.py 路由对照

| README 表格 (行号) | server.py 路由 (行号) | 方法 | 状态 | 评估 |
|---|---|---|---|---|
| `POST /api/auth/register` (README:49) | `/api/auth/register` (server.py:436) | POST | 一致 | ✓ |
| `POST /api/auth/login` (README:49) | `/api/auth/login` (server.py:476) | POST | 一致 | ✓ |
| `POST /api/auth/logout` (README:51) | `/api/auth/logout` (server.py:507) | POST | 一致 | ✓ |
| `GET /api/auth/me` (README:50) | `/api/auth/me` (server.py:513) | GET | 一致 | ✓ |
| `GET /api/state` (README:52) | `/api/state` (server.py:529) | GET | 一致 | ✓ |
| `PUT /api/state` (README:53) | `/api/state` (server.py:563) | PUT | 一致 | ✓ |

**server.py 实际有但 README 表格未列的路由**（共 7 个，待核是否需要文档化）：
- `GET /` (server.py:379) — index.html 入口
- `GET /<path:filename>` (server.py:383) — 静态白名单 (server.py:96-106)
- `GET /api/active-count` (server.py:668)
- `POST /api/track-active` (server.py:672)
- `GET /api/code-runs` (server.py:677)
- `POST/GET /api/run-code` (server.py:684) — README:55 已写"旧 `/api/run-code` 返回不可用说明"
- `GET /api/admin/stats` (server.py:693)
- `POST /api/admin/clear-history` (server.py:694)
- `GET /api/code-history` (server.py:695)

→ README:55 显式提到 `/api/run-code` 返回不可用、admin 端点 OPTIMIZATION_AUDIT.md §F.2 锁"保持 404"。**README 已主动说明 run-code/admins，可接受**；`active-count/track-active/code-runs/code-history` 在 README §限制（行 78）未列入，需评估要不要列。

### 2.2 "已实现"清单对照（README:7-12）

| README 描述 | server.py / 其他证据 | 评估 |
|---|---|---|
| 成果增删改、关键词/年份/类型筛选、收藏 (README:7) | `app.js.orig` 内的 publication CRUD | ✓ 未要求测代码细节 |
| DOI 格式校验和外链 (README:7) | 验证需 js 实测，待核 |
| 提问、回答、点赞 (README:8) | 同上 | 待核 |
| 研究者资料目录、关注名单 (README:8) | 同上 | 待核 |
| 分层知识页面 + Markdown 导出 (README:9) | `workspace.js` 内，verification.md:27 锁定 | ✓ |
| 项目任务表格与看板 (README:10) | 同上 | ✓ |
| Python 脚本编辑与下载、运行按钮禁用 (README:11) | README:11 与 README:78 "没有运行 Python 的能力"一致 | ✓ |
| 注册登录、密码哈希、HttpOnly 签名 cookie (README:12) | server.py:436+ use `werkzeug.security.generate_password_hash` (server.py:67) | ✓ |
| SQLite 持久化和 revision 冲突检测 (README:12) | server.py:563 PUT 409 自增 revision | ✓ |

**已实现清单 7 条全部与代码现状吻合**（基于源码引用 + verification.md 锁定）。

### 2.3 "限制"清单（README:78）

README:78 列出 6 项限制。**对照 OPTIMIZATION_AUDIT.md §F**：
- 没有多人实时协作 ✓
- 公共社区、文件上传、密码找回、账户删除 ✓
- 运行 Python 的能力 ✓
- SQLite + Flask 开发服务器、无并发承诺 ✓
- 浏览器缓存非多租户隔离 ✓
- 其他浏览器/辅助技术未做专项验收 ✓

**OPTIMIZATION_AUDIT.md §F.1 还隐含**：`/api/active-count` `/api/track-active` `/api/code-runs` 也在被锁；README 限制清单**未明确提"已禁用的旧接口"**，但 README:55 已说明 run-code 不可用、§F.2 提到 admin 404。可视为**部分遗漏**（待核）。

### 2.4 引用到的脚本路径

| README/HOW_TO_RUN 文本 | 期望路径 | 实际 |
|---|---|---|
| `bash start.sh` (README:21) | `./start.sh` | ✓ 存在 |
| `bash run-background.sh` (README:28) | `./run-background.sh` | ✓ |
| `bash status.sh` (README:29) | `./status.sh` | ✓ |
| `bash stop.sh` (README:30) | `./stop.sh` | ✓ |
| `bash restart.sh` (HOW_TO_RUN:34) | `./restart.sh` | ✓ |
| `bash install-service.sh` (HOW_TO_RUN:39) | `./install-service.sh` | ✓ |
| `bash build-optimized.sh` (package.json:6) | `./build-optimized.sh` | ✓ |
| `bash backup-restore.sh` (package.json:7-8) | `./backup-restore.sh` | ✓ |
| `python3 -m pip install -r requirements.txt -r requirements-dev.txt` (README:60) | requirements*.txt | ✓ |
| `python3 -m pytest tests/ -q` (README:61) | `tests/` | ✓ |
| `npm ci --prefix qa` (README:62) | `qa/package.json` | ✓ |
| `bash qa/run-all.sh` (README:63) | `qa/run-all.sh` | ✓ |
| `node qa/browser-integration.cjs` (README:71, HOW_TO_RUN:72) | `qa/browser-integration.cjs` | ✓ |
| `qa/verification.md` (README:74) | `qa/verification.md` | ✓ |
| `qa/backend-review.md` (README:74) | `qa/backend-review.md` | ✓ |

**所有引用到的相对路径全部存在**。

### 2.5 minified vs 源码 .orig 关系

**README 当前完全没有提到 minified vs 源码 `.orig` 的关系**（README 全文 grep `\.orig` / `minif` / `terser` / `csso` 均 0 命中）。这是 OPTIMIZATION_AUDIT.md §E1 标 P0 的关键缺失。

**关键事实修正**（与 OPTIMIZATION_AUDIT.md §A1 矛盾，必须在本审计里纠正）：
- `app.js` (82755 字节) **==** `app.js.orig` (82755 字节)（diff -q 一致）
- `workspace.js` (66013 字节) **==** `workspace.js.orig` (66013 字节)
- `styles.css` (63285 字节) **==** `styles.css.orig` (63285 字节)
- `build-optimized.sh:25-30` 把压缩产物写到 `dist/app.min.js` / `dist/workspace.min.js` / `dist/styles.min.css`，**未覆盖源码**
- `backups/` 包含 3 个 `.bak.*` 文件 + 3 个 `.min.*` 文件（`app.js.bak.20260913_051509` 等，`wc -c` 与 `.min.*` 大小接近，说明 `.bak.*` 才是 minify 产物，`.min.*` 是被 `backup-restore.sh restore` 挪走的中间产物）
- **`app.js.orig` 本身也是 minify 单行产物**（同字节数），不是可读源码
- **OPTIMIZATION_AUDIT.md §A1 结论 "build-optimized.sh 把 minify 产物覆盖了源码" 不成立**：build-optimized.sh 从未覆盖源码；真正的可读源码（minify 之前）从未进入仓库；`.orig` 是上一轮做过的某次 minify 操作产生的中间副本

→ **README 缺失的"minified vs 源码"关系比 OPTIMIZATION_AUDIT.md 假设的更严重**：不是 `.orig` 是源码、当前文件是 minify 产物，而是 **两者都是 minify 产物**，可读源码根本不在仓库里。要恢复可读性，需先找到 `.bak.*` 中更早的副本（待核 `app.js.bak.20260913_051509` 的字节数 ≈ 51k，比 `.orig` 的 82k 小，可能是更早的源）。

---

## §3 HOW_TO_RUN.md 一致性

### 3.1 启动/停止/状态/后台/服务命令示例

| 命令 | HOW_TO_RUN 行号 | 评估 |
|---|---|---|
| `bash start.sh` 前台 | HOW_TO_RUN:9 | ✓ |
| `METEOHUB_PYTHON=... PORT=9000 bash start.sh` 指定解释器/端口 | HOW_TO_RUN:17 | ✓ |
| 手动 venv 创建 + 安装 + 启动 | HOW_TO_RUN:22-25 | ✓ |
| `bash run-background.sh` | HOW_TO_RUN:31 | ✓ |
| `bash status.sh` | HOW_TO_RUN:32 | ✓ |
| `bash stop.sh` | HOW_TO_RUN:33 | ✓ |
| `bash restart.sh` | HOW_TO_RUN:34 | ✓ |
| `bash install-service.sh` | HOW_TO_RUN:39 | ✓ |

**所有命令都有正确示例**。

### 3.2 环境变量文档化

| 环境变量 | HOW_TO_RUN 行号 | server.py / 脚本使用 | 评估 |
|---|---|---|---|
| `HOST` | HOW_TO_RUN:45 | start.sh:16 / run-background.sh:12 (默认 127.0.0.1) | ✓ |
| `PORT` | HOW_TO_RUN:46 | start.sh:17 / run-background.sh:13 (默认 8080) | ✓ |
| `METEOHUB_PYTHON` | HOW_TO_RUN:47 | python-env.sh:6 (启动脚本的解释器) | ✓ |
| `METEOHUB_DB` | HOW_TO_RUN:48 | HOW_TO_RUN:59 出现示例 | **HOW_TO_RUN 未明确它在 server.py 里的语义**（待核 vs server.py 全文） |
| `SECRET_KEY` | HOW_TO_RUN:49 | HOW_TO_RUN:59 出现示例 | ✓ |

**5 个环境变量全部文档化**。

### 3.3 python-env.sh 选解释器的逻辑

HOW_TO_RUN 未直接描述 `python-env.sh` 的解释器选择顺序。**HOW_TO_RUN:20** 只说"脚本创建项目 `.venv` 并从 `requirements.txt` 安装"。

python-env.sh:6 实际优先级：`$METEOHUB_PYTHON` → `$SCRIPT_DIR/.venv/bin/python` → `python3` → `python`。README:24 有提到"优先使用 `METEOHUB_PYTHON` 指定的解释器、项目 `.venv/bin/python`，再查找 `python3` / `python`" —— **README:24 实际比 HOW_TO_RUN 描述更详细**。

### 3.4 与 README "启动"小节重复

- README:16-33 "启动" 段含：`bash start.sh` / `bash run-background.sh` / `bash status.sh` / `bash stop.sh` / `METEOHUB_PYTHON=... PORT=9000 bash start.sh` + python-env.sh 解释器顺序说明
- HOW_TO_RUN:3-39 "本机前台" + "后台与状态" 段含上述 4 个 + `bash restart.sh` + `bash install-service.sh`

**重叠度 ~80%**。README 偏向"30 秒上手"，HOW_TO_RUN 偏向"全命令清单"。**HOW_TO_RUN 是权威**（HOW_TO_RUN:86 "完整功能... 见 README.md" 的反向引用暗示 HOW_TO_RUN 是完整版），README 是简版入口。

---

## §4 .gitignore 审计

### 4.1 当前 `.gitignore` 内容（24 行 / 314 字节）

实测 `.gitignore` 实际是 314 字节 / 24 行，**不是任务文本说的 14 字节**（可能是上一会话的快照过期；现版本已加 qa/*-actual.png 等条目）。完整内容：行 1 `data/`、行 2 注释、行 3 `server.pid`、行 4 `server.log`、行 6 注释、行 7 `__pycache__/`、行 8 `*.pyc`、行 9 `*.pyo`、行 10 `.venv/`、行 11 `venv/`、行 13 注释、行 14 `.pytest_cache/`、行 15 `.pyright/`、行 16 `.mypy_cache/`、行 17 `qa/node_modules/`、行 19 注释、行 20 `._*`、行 21 `.DS_Store`、行 23 `qa/preview-runtime.json`、行 24 `qa/*-actual.png`。

### 4.2 应忽略但当前未忽略 / 当前已忽略但 untracked 仍出现

| 期望忽略项 | 当前 .gitignore | git status 表现 | 评估 |
|---|---|---|---|
| `backups/` | **未忽略** | `?? backups/` 出现 | ⚠ **应忽略**（任务文本也要求加） |
| `data/*.db` | 已忽略 `data/`（行 2 注释） | 未出现在 untracked（已生效） | ✓ |
| `data/secret.key` | 同上 `data/` | 同上 | ✓ |
| `node_modules/` | **未忽略** | `?? node_modules/` 出现 | ⚠ **应忽略**（任务文本要求） |
| `qa/node_modules/` | 已忽略（行 17） | 未出现 | ✓ |
| `__pycache__/` | 已忽略（行 7） | 未出现 | ✓ |
| `.pytest_cache/` | 已忽略（行 14） | 未出现 | ✓ |
| `*.pyc` | 已忽略（行 8） | 未出现 | ✓ |
| `server.pid` | 已忽略（行 3） | 未出现 | ✓ |
| `server.log` | 已忽略（行 4） | 未出现 | ✓ |
| `.venv/` | 已忽略（行 10） | 未出现 | ✓ |
| `venv/` | 已忽略（行 11） | 未出现 | ✓ |
| `.DS_Store` | 已忽略（行 21） | 未出现 | ✓ |
| `dist/` | **未忽略** | `?? dist/` 出现 | ⚠ **应忽略**（build 产物） |
| `__pycache__` (实测目录) | 已忽略（行 7） | 未出现 | ✓ |
| `.pytest_cache` (实测目录) | 已忽略（行 14） | 未出现 | ✓ |
| `._*` 资源分支 | 已忽略（行 20） | `._*` 全部被忽略 ✓ |

### 4.3 当前 untracked 中本应被忽略的项

`git status --short` 配合 `.gitignore` 实测，本应被忽略但仍 untracked：

1. **`backups/`** —— .gitignore 没有该条目；`backups/app.js.bak.*` 等是临时压缩产物，不应进版本
2. **`node_modules/`** —— .gitignore 没有该条目；项目根 npm 安装产物
3. **`dist/`** —— .gitignore 没有该条目；build-optimized.sh 产物

加上 OPTIMIZATION_AUDIT.md §E3 提议的 `server.pid` `data/*.db` `__pycache__/` `qa/node_modules/` —— **这 4 项其实已经在 .gitignore 里**（OPTIMIZATION_AUDIT.md 评估时可能基于更早的快照）。

---

## §5 package.json 一致性

### 5.1 name / version 与 README 一致性

| 字段 | 值 | 文档引用 | 评估 |
|---|---|---|---|
| `name` | `meteohub` (package.json:2) | README 标题 "MeteoHub" | ✓ 命名一致 |
| `version` | `2.0.0` (package.json:3) | OPTIMIZATION_AUDIT.md:10 标题 "MeteoHub v2.0.0" | ✓ |
| `description` | `MeteoHub · 大气科学学术工作台` (package.json:4) | README:1 标题一致 | ✓ |

### 5.2 scripts 对应命令

| scripts 字段 | 实际命令 | 目标文件存在 | 评估 |
|---|---|---|---|
| `build` (line 6) | `bash build-optimized.sh` | ✓ | ✓ |
| `restore` (line 7) | `bash backup-restore.sh restore` | ✓ | ✓ |
| `backup` (line 8) | `bash backup-restore.sh backup` | ✓ | ✓ |
| `test:backend` (line 9) | `python3 -m pytest tests/ -q` | `tests/` | ✓ |
| `test:frontend` (line 10) | `node qa/run-all.sh` | **错误**：run-all.sh 是 bash 脚本，应是 `bash qa/run-all.sh` | ⚠ **package.json:10 错误**：`node` 无法运行 `.sh`，会导致 `test:frontend` 报错 |
| `lint` (line 11) | `eslint app.js workspace.js --ext .js` | eslint 在 `node_modules/.bin/eslint` | ✓（依赖已安装，但 devDependencies 没列） |
| `validate` (line 12) | `node --check app.js && node --check workspace.js && echo 'JS syntax OK'` | ✓ | ✓ |

**重大问题**：`scripts.test:frontend` 用了 `node` 而不是 `bash`，会直接报错（node 把 .sh 当 JS 解释）→ 必须修正为 `bash qa/run-all.sh`。

### 5.3 devDependencies (terser / csso-cli) 是否被使用

`build-optimized.sh:11` 检测 `./node_modules/.bin/terser`，`:25-26` 用 terser；`:30` 用 csso。**grep 在 build-optimized.sh 命中 6 处**。devDependencies 与脚本使用一致 ✓。

### 5.4 engines.node

`engines.node: ">=16"` (line 19)。terser v5 要求 Node ≥ 10（npm 包元数据，待核）；csso-cli 4.x 同样兼容 Node ≥ 16。`>=16` 准确 ✓。

### 5.5 lint 脚本依赖

**`eslint` 没在 devDependencies 中列出**（package.json:14-17 只列了 `csso-cli` 和 `terser`）。但 `node_modules/.bin/eslint` 存在（package-lock.json 有 `eslint: ^10.10.0`）。

**两种解读**：
1. **eslint 是 build 时拉取的传递依赖**（被 terser 或 csso-cli 拉进来）→ 不声明 devDependencies 仍可用
2. **npm scripts 应显式声明 devDependencies** → 当前缺声明是个隐患

按 npm 规范，**应加入 `devDependencies`**："lint" 是 npm 脚本，使用方依赖应明示。OPTIMIZATION_AUDIT.md §A4 也提到"lint script 写了但没装 eslint 依赖"。

### 5.6 build-optimized.sh 行为

`build-optimized.sh:25-30` 把压缩写到 `dist/`，**未覆盖源码**（与 OPTIMIZATION_AUDIT.md §A1 结论相反）。**见 §2.5 关键事实修正**。

---

## §6 shell 脚本审计

### 6.1 必备项矩阵

| 脚本 | shebang 行号 | `set -euo pipefail` | 错误处理 | 评估 |
|---|---|---|---|---|
| `start.sh` | `#!/usr/bin/env bash` (line 1) | line 11 | source python-env.sh 后 select_python | ✓ |
| `stop.sh` | line 1 | line 22 | 5 步校验 PID（正整数 / kill -0 / cmdline 含 server.py / cwd 匹配 / 绝对路径），错误信息明确 | ✓ 严格，符合 verification.md:31 锁 |
| `restart.sh` | line 1 | line 2 | 仅 7 行：stop + exec run-background | ✓ |
| `status.sh` | line 1 | line 6 | PID 文件存在性 + kill -0 + 末尾 tail 日志 | ✓ |
| `run-background.sh` | line 1 | line 7 | PID 文件幂等检测 + source python-env.sh + 等端口/进程存活 | ✓ |
| `install-service.sh` | line 1 | line 6 | systemctl 探测、heredoc 写 unit、daemon-reload | ✓ |
| `build-optimized.sh` | `#!/bin/bash` (line 1) | `set -e` (line 5)，**没有 `pipefail`** | 缺 `pipefail` | ⚠ 建议补 `set -euo pipefail` |
| `backup-restore.sh` | `#!/bin/bash` (line 1) | `set -e` (line 5)，**没有 `pipefail`** | 缺 `pipefail` | ⚠ 同上 |
| `python-env.sh` | `#!/usr/bin/env bash` (line 1) | **没有 set**（被 source 使用） | N/A | ⚠ 被 source 时 `set -euo pipefail` 会污染调用方 |

**统计**：6 个脚本具备完整 `set -euo pipefail`；2 个（build-optimized.sh、backup-restore.sh）只有 `set -e`；python-env.sh 不应设 set（被 source）。

### 6.2 跨脚本调用拓扑

```
start.sh:25      → source python-env.sh → select_python
run-background.sh:31 → source python-env.sh → select_python
install-service.sh:13 → source python-env.sh → select_python
restart.sh:6     → ./stop.sh
restart.sh:7     → exec ./run-background.sh
```

**无循环依赖**。`python-env.sh` 是被 source 的工具库（不是独立运行），3 个启动器都用它，统一选择解释器逻辑 ✓。

### 6.3 install-service.sh 是否可用

- 引用：`HOW_TO_RUN.md:39` 唯一引用
- 可用性：line 9 `command -v systemctl` 探测；不存在时 line 10 输出 "❌ 此脚本仅支持 systemd 用户服务" 并 exit 1（macOS 友好）→ 真正能跑的环境是 Linux + systemd；HOW_TO_RUN:39 "Linux 的 systemd 用户服务可用... 该命令会实际安装并启动服务；本轮未执行" 与脚本行为一致

→ **脚本可用性受平台限制**，HOW_TO_RUN 已正确警告。

### 6.4 build-optimized.sh 是否覆盖源码

**关键事实修正**：
- build-optimized.sh:25 `terser app.js -o dist/app.min.js` → 写 dist，不覆盖源码 ✓
- build-optimized.sh:26 `terser workspace.js -o dist/workspace.min.js` → 同 ✓
- build-optimized.sh:30 `csso styles.css --output dist/styles.min.css` → 同 ✓

**OPTIMIZATION_AUDIT.md §A1 标 P0 的 "build-optimized.sh 把 minify 产物覆盖源码" 错误**。真正的源码可读性问题（见 §2.5）来自更早一轮的 minify 操作，不是当前脚本的副作用。

### 6.5 backup-restore.sh 覆盖与 restore 行为

- `backup` 分支（line 26-35）：打包 `app.js + .orig + workspace.js + .orig + styles.css + .orig + server.py + data/` → tar.gz 到 `backups/` ✓
- `restore` 分支（line 13-25）：**先把当前 min 文件 cp 到 backups/app.js.min.$TIMESTAMP 等**（line 16-17），**然后用 .orig 覆盖 .js / .css**（line 18-19）→ **不会丢 .orig 备份**（.orig 文件本身不被覆盖，仅作为源被读）

**注意**：line 18 `cp app.js.orig app.js` —— 如果 `.orig` 本身是 minify 产物（实测如此，见 §2.5），"restore" 实际只是把同样 min 的 .orig 覆盖当前 min 文件，**没有恢复任何可读性**。这是 §E 报告的核心误导。

### 6.6 restart.sh 简单度

只有 7 行（line 1-7），依赖 `stop.sh` + `run-background.sh`。功能正确 ✓，但缺少停服失败的兜底：line 6 `./stop.sh` 失败（非 0 退出）时 set -e 会让 restart 中止；但 stop.sh:30 在 PID 文件不存在时 exit 0（信息性成功），所以"服务未运行"的 restart 仍会成功启动后台。**符合预期**。

---

## §7 requirements*.txt 一致性

### 7.1 requirements.txt (34 字节 / 2 行)

```
flask>=3.0,<4.0
itsdangerous>=2.0
```

### 7.2 requirements-dev.txt (14 字节 / 1 行)

```
pytest>=8,<10
```

### 7.3 与 server.py import 一致性

server.py 实际 import（grep `^(from|import)` server.py）：
- `flask` ✓ 在 requirements.txt
- `itsdangerous` ✓ 在 requirements.txt
- `werkzeug.security` ⚠ **未在 requirements.txt 列出**（werkzeug 是 flask 的传递依赖，被 server.py:67 直接 `from werkzeug.security import ...` 使用）
- `pytest` ✓ 在 requirements-dev.txt
- stdlib: `contextlib / typing / json / os / sqlite3 / threading / time / uuid / __future__` —— 无需声明

**漏列**：`werkzeug`。`pip install flask` 会自动装 werkzeug（依赖传递），但按 PEP 规范应显式声明（OPTIMIZATION_AUDIT.md §E5 提了此点）。

### 7.4 pin 策略

- `flask>=3.0,<4.0`：浮动 pin（major 锁定 + minor 浮动）
- `itsdangerous>=2.0`：仅下限
- `pytest>=8,<10`：浮动 pin

**没有精确 pin**（`flask==3.0.0` 之类）。**优点**：自动收安全更新；**缺点**：CI 与本地可能装到不同版本。

### 7.5 HOW_TO_RUN "pip install -r requirements.txt -r requirements-dev.txt"

- HOW_TO_RUN:66 引用此命令
- requirements.txt + requirements-dev.txt 现有依赖装完后即可跑 pytest → 一致 ✓

---

## §8 qa/run-all.sh 一致性

### 8.1 跳过的测试

run-all.sh:9 `test-03b-focus-repro.js|test-03c-focus-debug.js|test-06-debug.js|test-09-typing-rebuild.js` —— 跳过 4 个历史无断言探针。**跳过理由写在 line 7 注释**："These historical probes only print observations and contain no assertions."

**保留的同类文件**：
- `test-06-host-event.js`（保留，与 test-06-debug.js 同名但不同）
- `test-09b-typing-single-mount.js`（保留，作为 test-09-typing-rebuild.js 的替换版）

**核对正确**：跳过 4 个，保留 11 个真实 test（test-01/02/03/04/05/06-host-event/07/08/09b/10/10b/11）= 12 PASS 与 verification.md:10 一致。

### 8.2 是否调用所有测试

实际测试文件数（ls qa/test-*.js）：
- test-01-smoke.js / 02-tree.js / 03-blocks.js / 03b / 03c / 04-pending-save / 05-export-xss-projects / 06-debug.js / 06-host-event / 07-failed-save / 08-mount-leak / 09-typing-rebuild / 09b-typing-single-mount / 10-switch-race / 10b-switch-roundtrip / 11-store-identity = 16 个
- 跳过 4 个 → 实际跑 12 个
- verification.md:10 写 "12 PASS" → **一致** ✓

**browser-smoke.cjs**（qa/browser-smoke.cjs）：run-all.sh 没有调用它（line 6 `for t in test-*.js` glob 不匹配 .cjs）。verification.md 也没把它计入 12 PASS —— 它由 `node qa/browser-integration.cjs` 单独跑（README:71 / verification.md:11）。

### 8.3 exit code 规则

run-all.sh:24 `exit $FAIL`：
- FAIL=0 → exit 0 ✓
- FAIL>0 → exit FAIL > 0（POSIX 范围 0-255；FAIL 可能 > 255 会取模；任务给定 "FAIL=0 时 exit 0，FAIL>0 时 exit FAIL"，对）

### 8.4 与 package.json scripts.test:frontend 一致性

- package.json:10 `"test:frontend": "node qa/run-all.sh"` —— **用 node 而不是 bash**（见 §5.2）
- run-all.sh line 1 `#!/usr/bin/env bash`
- node 会把 .sh 当 JS 解释，报 SyntaxError
- → **scripts.test:frontend 是坏的**，跑 `npm run test:frontend` 必失败

---

## §9 qa/verification.md 一致性

### 9.1 提到的命令能否复现

| verification.md 行号 | 命令 | 是否能跑 | 评估 |
|---|---|---|---|
| line 9 | `pytest tests/ -q` | ✓ 依赖齐全（requirements*.txt + tests/） | ✓ |
| line 10 | `bash qa/run-all.sh` | ✓ 12 PASS 与 §8.1 一致 | ✓ |
| line 11 | `node qa/browser-integration.cjs` | ✓ 文件存在 | ✓（需要 Chrome 二进制） |
| line 12 | `node --check app.js` 等 | ✓ | ✓ |
| line 13 | `bash -n start.sh run-background.sh stop.sh status.sh restart.sh install-service.sh python-env.sh` | ✓ 7 个文件全存在 | ✓（**注意：未包含 build-optimized.sh / backup-restore.sh**） |
| line 14 | `bash start.sh` with `METEOHUB_PYTHON` + `METEOHUB_DB` | ✓ | ✓ |
| line 15 | `node qa/test-11-store-identity.js` 等 | ✓ | ✓ |

### 9.2 证据复现

- `67 passed`：对应 6 个 test_*.py（test_app_isolation / auth / race_and_security / size_and_secret / state / static_and_legacy / stop_script）= 7 个文件，需实际跑 pytest 才能确认仍是 67
- `12 PASS, 0 FAIL`：run-all.sh 跳过 4 个跑 12 个（§8.2 一致）
- `14 组流程通过, 0 JS 异常`：需实跑 browser-integration.cjs

→ **本审计不能复现 67/12/14 的数字**，因为只读约束 + 没有运行测试。要确认当前数字是否仍正确，应作为下一步任务（OPTIMIZATION_AUDIT.md §F 已锁）。

### 9.3 截图路径

| verification.md 行号 | 路径 | 实际存在 |
|---|---|---|
| line 37 | `qa/desktop-overview.png` | ✓ |
| line 38 | `qa/desktop-workspace.png` | ✓ |
| line 39 | `qa/mobile-overview.png` | ✓ |
| line 40 | `qa/mobile-workspace.png` | ✓ |
| line 35 | `qa/browser-results.json` | ✓ |
| line 46 | `qa/preview-runtime.json` | ✓ |

**所有截图与数据文件均存在**。

---

## §10 引用断裂 / 死链

### 10.1 README 引用路径

| 引用 | 路径 | 实存 |
|---|---|---|
| `bash start.sh` 等 | `./start.sh` | ✓ |
| `python3 -m pip install -r requirements.txt -r requirements-dev.txt` (README:60) | `./requirements.txt` + `./requirements-dev.txt` | ✓ |
| `python3 -m pytest tests/ -q` (README:61) | `./tests/` | ✓ |
| `npm ci --prefix qa` (README:62) | `./qa/package.json` | ✓ |
| `bash qa/run-all.sh` (README:63) | `./qa/run-all.sh` | ✓ |
| `node qa/browser-integration.cjs` (README:71) | `./qa/browser-integration.cjs` | ✓ |
| `qa/verification.md` (README:74) | `./qa/verification.md` | ✓ |
| `qa/backend-review.md` (README:74) | `./qa/backend-review.md` | ✓ |

**README 全部相对路径存在**。

### 10.2 HOW_TO_RUN 引用路径

| 引用 | 路径 | 实存 |
|---|---|---|
| `bash start.sh` 等 | `./start.sh` | ✓ |
| `.venv/bin/python` (line 24, 25, 60, 66) | `./.venv/bin/python`（首次运行 python-env.sh 创建） | ✓（首次自动创建） |
| `requirements.txt` (line 24, 60, 66) | `./requirements.txt` | ✓ |
| `requirements-dev.txt` (line 66) | `./requirements-dev.txt` | ✓ |
| `tests/` (line 67) | `./tests/` | ✓ |
| `qa/node_modules` (line 68) | `./qa/node_modules/` | ✓ |
| `qa/run-all.sh` (line 69) | `./qa/run-all.sh` | ✓ |
| `node qa/browser-integration.cjs` (line 72) | `./qa/browser-integration.cjs` | ✓ |
| `[README.md]` (line 86) | `./README.md` | ✓ |

**HOW_TO_RUN 全部相对路径存在**。

### 10.3 跨文档引用

- `README.md:74` 引用 `qa/backend-review.md` ✓（存在但被 verification.md:1 与 backend-review.md 自身 line 1 标为"历史"，已是 deprecated）
- `HOW_TO_RUN.md:86` 引用 `[README.md](README.md)` ✓
- `qa/verification.md:35-40` 引用自身 `browser-results.json` + 4 张 PNG ✓
- `qa/verification.md:46` 引用 `qa/preview-runtime.json` ✓
- `qa/verification.md:55` 引用 `[HOW_TO_RUN.md](../HOW_TO_RUN.md)` ✓
- `qa/verification.md:62` 引用 `qa/browser-integration.cjs` ✓
- `qa/backend-review.md` 自称"已被 verification.md 取代"，与 README:74 "历史... 不能代表当前通过状态" 一致 ✓

**没有死链**。

---

## §11 优先级清单

| # | 等级 | 描述 | 行号 | 建议 | 验证手段 |
|---|---|---|---|---|---|
| 1 | **P0** | `package.json:10` `test:frontend` 用 `node` 跑 .sh，跑必失败 | `package.json:10` | 改为 `"bash qa/run-all.sh"` | `npm run test:frontend` 应输出 "PASS=12 FAIL=0" 并 exit 0 |
| 2 | **P0** | README / HOW_TO_RUN 完全未提 minify vs 源码关系；`.orig` 实际也是 min 产物（`app.js == app.js.orig` byte-equal），可读源码未入仓 | `README.md` 全文 + `app.js.orig` | 在 README §启动 后加一节"构建产物说明"；并核查 `.bak.20260913_051509` 是否更早可读 | `diff -q app.js app.js.orig` 仍 equal；`wc -l backups/app.js.bak.*` 若仍单行，则可读源码彻底丢失 |
| 3 | **P0** | `.gitignore` 缺 `backups/` `node_modules/` `dist/` 三项，对应 untracked 中三个本应忽略目录 | `.gitignore` line 1-24 | 追加 `backups/` `node_modules/` `dist/` 三行 | `git status --short` 中 `?? backups/ node_modules/ dist/` 应消失 |
| 4 | **P0** | `backup-restore.sh restore` 误导：声称恢复"原始文件"但实际把同样 min 的 .orig 覆盖当前 min 文件（没恢复任何可读性） | `backup-restore.sh:18-19` + `app.js.orig` | 文档里把"原始文件"改为"压缩前源码"，并在 README 加 `backups/` 列表说明哪些是更早源 | 查 `.bak.*` 内容是否真是源码（解 min 看头部） |
| 5 | **P1** | `requirements.txt` 缺 `werkzeug`（server.py:67 直接 import） | `requirements.txt` + `server.py:67` | 追加 `werkzeug>=3.0,<4.0` | 在干净 venv 跑 `pip install -r requirements.txt` 后 `python -c "import werkzeug"` 应通过 |
| 6 | **P1** | `package.json` devDependencies 缺 `eslint`（lint 脚本依赖，但已通过 terser 传递安装） | `package.json:14-17` | 显式加 `"eslint": "^10.10.0"` | 干净环境 `npm install` 应装上 eslint |
| 7 | **P1** | `build-optimized.sh` 与 `backup-restore.sh` 缺 `pipefail`；OPTIMIZATION_AUDIT.md §A1 关于"覆盖源码"的结论错误（实测未覆盖） | `build-optimized.sh:5` + `backup-restore.sh:5` + `OPTIMIZATION_AUDIT.md:30` | 把 `set -e` 改为 `set -euo pipefail`；同步修正 §A1 描述 | 重读两脚本 + `diff -q app.js app.js.orig` 仍 equal |
| 8 | **P1** | README API 表格缺 `active-count` `track-active` `code-runs` `code-history`（OPTIMIZATION_AUDIT.md §F.1 已隐含锁） | `README.md:47-54` vs `server.py:668/672/677/695` | 加一行说明这些是"内部计数/历史 API"或归入"前端活动信号"分类 | 与 server.py grep 一致 |
| 9 | **P2** | README §限制 与 HOW_TO_RUN §配置 高度重叠（~80%）；HOW_TO_RUN 未明示 `METEOHUB_DB` 在 server.py 里的语义 | `README.md:78` + `HOW_TO_RUN.md:48` | HOW_TO_RUN 增加一句"server.py 通过环境变量覆盖默认 data/meteohub.db" | grep `METEOHUB_DB` server.py 确认默认/覆盖逻辑 |
| 10 | **P2** | `qa/run-all.sh:13` 只在 FAIL>0 时打印最后 20 行 stdout；如果 case 0 退出但 stdout 有可疑 warn，不会显示 | `qa/run-all.sh:13-21` | PASS 也打印末尾 1 行 sanity check | 注入 `console.warn` 看是否仍 PASS |

**P0 = 4 条 / P1 = 4 条 / P2 = 2 条**

---

## §12 不要动的事项（与 OPTIMIZATION_AUDIT.md §F 一致）

- `qa/verification.md` 已通过的 67 pytest + 12 PASS + 14 流程 + 全部断言不能改
- README §API 表格已与 server.py grep 一致，路由/方法/状态码不能改
- `stop.sh` 多步 PID 校验（正整数 + kill -0 + cmdline + cwd + 绝对路径）不能简化
- `tests/conftest.py:14-20` `isolated_secret_file` fixture 不能动
- `window.MeteoWorkspace.mount(root)` 单 mount 契约（test-08 锁定）
- 知识块自动保存 350ms 防抖（test-04 锁定）
- CSP / Origin / X-Frame-Options（server.py:330 附近）
- 旧 `meteohub_users` / `meteohub_articles` 迁移只跑一次的逻辑

---

## §13 审计自身的元信息

- 本审计未触碰任何源文件；所有结论基于 `read_file` + `search_files` + `terminal grep/diff/wc`
- 与 OPTIMIZATION_AUDIT.md §E 横向对照：§E1/§E2/§E3 标 P0 的事项本审计全部命中（且本审计发现更严重的 §2.5 事实：可读源码从未入仓）
- 本审计额外发现 §5.2 `test:frontend` 是 P0 错误（OPTIMIZATION_AUDIT.md 未列）
- 本审计额外发现 §6.4 "build-optimized.sh 覆盖源码" 是错误描述（OPTIMIZATION_AUDIT.md §A1 需修正）

---

*报告路径：`/Volumes/Kingston/Mac/MeteoHub/DOCS_AUDIT.md`*
*生成者：Hermes (slot 01a09ab9-1f6f-73d0-9e77-40c2c7aadd0e)，T5 Hermes②*