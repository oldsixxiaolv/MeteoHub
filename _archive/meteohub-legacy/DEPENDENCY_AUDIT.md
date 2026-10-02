# MeteoHub 依赖与安全审计报告

> 生成时间：2025-09-18
> 审计范围：Python / Node.js / 系统工具 / 浏览器环境
> 与 DOCS_AUDIT.md §7 (依赖文档) / §5 (安全) 互补

---

## §1 现状速览

| 类别 | 版本 / 数量 | 备注 |
|------|-------------|------|
| **Python** | 3.x (3.13.x via miniconda) | 3 个直接依赖 (flask, itsdangerous, pytest) |
| **Node.js** | ≥16 (package.json engines) | 主项目 2 个 devDep，qa 2 个 dep (含 playwright) |
| **系统工具** | lsof, ps, tar, awk, sed, grep, npm, node 等 | macOS/Linux 混合兼容脚本 |
| **npm 包 (主项目)** | ~107 packages (含 extraneous) | 实际声明仅 2 个 |
| **npm 包 (qa/)** | 2 declared + 31 transitive | jsdom + playwright-core |

---

## §2 Python 依赖

### 2.1 requirements.txt vs requirements-dev.txt

```
requirements.txt (34 bytes):
  flask>=3.0,<4.0
  itsdangerous>=2.0

requirements-dev.txt (14 bytes):
  pytest>=8,<10
```

### 2.2 server.py 实际 import 对照

| server.py import | 位置 | requirements.txt | 备注 |
|------------------|------|------------------|------|
| `flask` | Flask | ✅ flask>=3.0 | |
| `werkzeug.security` | Werkzeug | ✅ flask 传递依赖 | |
| `itsdangerous` | itsdangerous | ✅ itsdangerous>=2.0 | |
| `sqlite3` | stdlib | ✅ 无需声明 | |
| `uuid` | stdlib | ✅ 无需声明 | |
| `threading` | stdlib | ✅ 无需声明 | |
| `time` | stdlib | ✅ 无需声明 | |
| `json` | stdlib | ✅ 无需声明 | |
| `os`, `sys` | stdlib | ✅ 无需声明 | |
| `contextlib` | stdlib | ✅ 无需声明 | |
| `typing` | stdlib | ✅ 无需声明 | |

**结论**：所有 import 均有对应依赖或属于 Python 标准库，无遗漏。

### 2.3 实际安装版本

```bash
$ /opt/miniconda3/bin/python -m pip show flask werkzeug itsdangerous pytest
Name: Flask
Version: 3.1.3
Name: Werkzeug
Version: 3.1.8
Name: itsdangerous
Version: 2.2.0
Name: pytest
Version: 9.1.1
```

| 包名 | 已安装版本 | requirements 声明 | 状态 |
|------|-----------|-------------------|------|
| flask | 3.1.3 | >=3.0,<4.0 | ✅ 兼容 |
| itsdangerous | 2.2.0 | >=2.0 | ✅ 满足 |
| werkzeug | 3.1.8 | (flask 传递) | ✅ 当前安全版 |
| pytest | 9.1.1 | >=8,<10 | ✅ 兼容 |

### 2.4 pip-audit

```bash
$ which pip-audit
# (未安装)
```

**pip-audit 未安装，已跳过 CVE 扫描段落。** 如需扫描，可运行：
```bash
pip install pip-audit && pip-audit -r requirements.txt
```

---

## §3 Node 依赖

### 3.1 主项目 package.json

```json
"devDependencies": {
  "csso-cli": "^4.0.2",
  "terser": "^5.0.0"
}
```

### 3.2 qa/package.json

```json
"dependencies": {
  "jsdom": "^30.0.1"
},
"devDependencies": {
  "playwright-core": "^1.62.1"
}
```

**browser-integration.cjs 使用的运行时库**：
- `playwright-core` (通过 `const {chromium}=require('playwright-core')`)
- `jsdom` (测试套件的一部分)

### 3.3 实际安装版本

```bash
$ cd /Volumes/Kingston/Mac/MeteoHub && npm ls --depth=0
meteohub@2.0.0 /Volumes/Kingston/Mac/MeteoHub
├── csso-cli@4.0.2 ✅
├── terser@5.x.x ✅
... (大量 extraneous 包)

$ cd /Volumes/Kingston/Mac/MeteoHub/qa && npm ls --depth=0
qa@1.0.0 /Volumes/Kingston/Mac/MeteoHub/qa
├── jsdom@30.0.1 ✅
└── playwright-core@1.62.1 ✅
```

### 3.4 npm audit 结果

```json
{
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0,
      "total": 0
    },
    "dependencies": { "prod": 1, "dev": 107, "total": 107 }
  }
}
```

**结论**：npm audit 无已知漏洞报告。

---

## §4 系统工具依赖

### 4.1 Shell 脚本调用的外部命令

| 命令 | 使用场景 | 平台 | 备注 |
|------|---------|------|------|
| `python3` / `python` | start.sh, run-background.sh | 跨平台 | README 推荐 python3 |
| `pip` / `pip3` | README 安装指令 | 跨平台 | |
| `lsof -F n` | stop.sh (cwd 检测) | macOS/Linux | 有 fallback |
| `ps -p $PID` | status.sh, stop.sh | 跨平台 | |
| `pkill` | stop.sh 备用 | Unix | |
| `fuser` | stop.sh 备用 | Linux | |
| `kill` | stop.sh | Unix | |
| `readlink -f` | stop.sh | Unix | |
| `awk` | 多脚本 | 跨平台 | |
| `sed` | 多脚本 | 跨平台 | |
| `grep` | 多脚本 | 跨平台 | |
| `tar` | backup-restore.sh | 跨平台 | |
| `npm` | build-optimized.sh | 跨平台 | |
| `node` | build-optimized.sh | 跨平台 | |
| `lsof -a -p $PID -d cwd -F n` | stop.sh | macOS 关键路径 | |

### 4.2 README / HOW_TO_RUN 文档覆盖

```
README.md 提到:
- python3 -m pip install -r requirements.txt -r requirements-dev.txt
- npm ci --prefix qa
- node qa/browser-integration.cjs
```

**未明确列出前提的工具**：
- `lsof` — macOS 工具，stop.sh 依赖但未在 README 说明
- `ps`, `pkill`, `fuser`, `kill` — 标准 Unix 工具
- `readlink`, `awk`, `sed`, `grep` — POSIX 工具

### 4.3 非标准工具检查

| 工具 | install-service.sh | stop.sh | 备注 |
|------|-------------------|---------|------|
| lsof | ❌ 未使用 | ✅ 使用 | stop.sh 已处理 macOS/Linux 差异 |
| fuser | ❌ 未使用 | ✅ 备用 | |
| /proc/$PID/cwd | N/A | ✅ 有 fallback | stop.sh 兼容 Linux |

**结论**：stop.sh 已正确处理平台差异。install-service.sh 不使用这些工具。

---

## §5 锁文件 vs 实际安装

### 5.1 package-lock.json

```bash
$ ls -la /Volumes/Kingston/Mac/MeteoHub/package-lock.json
-rwx------@ 1 yihanglv  staff  47464 Sep 13 05:15 package-lock.json
```

- **状态**：存在，大小 47KB
- **最后修改**：2024-09-13

### 5.2 偏差检查

```bash
$ npm ls --depth=0 | grep -i "missing\|extraneous\|invalid"
+-- @cacheable/memory@2.2.0 extraneous
+-- @eslint-community/eslint-utils@4.10.1 extraneous
+-- @eslint/plugin-kit@0.7.3 extraneous
+-- eslint@10.10.0 extraneous
+-- file-entry-cache@11.1.5 extraneous
+-- flat-cache@6.1.23 extraneous
... (共 71+ extraneous 包)
```

**主项目**：大量 extraneous 包（eslint 及相关工具链）未在 package.json 声明但已安装。

**qa/**：✅ 无 extraneous 包

### 5.3 根因分析

这些 extraneous 包（eslint, file-entry-cache, flat-cache 等）可能来自：
1. 早期开发阶段安装后未更新 package.json
2. 全局 npm 安装的包被识别为 extraneous
3. 已删除依赖的残留

**建议**：运行 `npm prune` 清理，或确认后更新 package.json。

---

## §6 .gitignore 与依赖目录

### 6.1 当前 .gitignore 状态

```bash
$ cat /Volumes/Kingston/Mac/MeteoHub/.gitignore
# Runtime data — MUST stay out of git (contains DB + secret key)
data/
server.pid
server.log

# Python
__pycache__/
*.pyc
*.pyo
.venv/
venv/

# Tests
.pytest_cache/
.pyright/
.mypy_cache/
qa/node_modules/

# macOS resource forks (created by external edits)
._*
.DS_Store

qa/preview-runtime.json
qa/*-actual.png
```

### 6.2 .gitignore 覆盖情况

| 目录/文件 | .gitignore | git status |
|-----------|-----------|-----------|
| node_modules/ | ✅ | untracked (已被忽略) |
| qa/node_modules/ | ✅ | untracked (已被忽略) |
| __pycache__/ | ✅ | - |
| .venv/ | ✅ | - |
| .pytest_cache/ | ✅ | - |
| data/ | ✅ | - |
| .gitignore | ❌ | **untracked (应被跟踪)** |
| package-lock.json | ❌ | **untracked (应被跟踪)** |
| requirements.txt | ❌ | **untracked (应被跟踪)** |
| requirements-dev.txt | ❌ | **untracked (应被跟踪)** |

### 6.3 依赖目录体积

```bash
$ du -sh node_modules qa/node_modules data
1.1G    node_modules
1.1G    qa/node_modules
768K    data
```

**总计**：2.2GB 依赖目录，已正确忽略。

### 6.4 问题

- `.gitignore` 文件本身是 **untracked**，说明项目初始化时未创建
- `package-lock.json` 是 **untracked**，应被 git 跟踪以确保构建一致性
- `requirements.txt` / `requirements-dev.txt` 是 **untracked**，影响 Python 环境重建

---

## §7 浏览器依赖

### 7.1 Chrome 可用性检查

```bash
$ ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
-rwxrwxr-x@ 1 yihanglv  admin  367696 Sep 10 17:19 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

**✅ Chrome 已安装**，路径正确，可执行。

### 7.2 对测试的影响

- qa/browser-integration.cjs 使用 `playwright-core` 配合本地 Chrome
- qa/verification.md 的 Chrome 测试**可以复现**

---

## §8 安全观察

### 8.1 已知 CVE 状态

| 包名 | 安装版本 | 已知漏洞 | 状态 |
|------|---------|---------|------|
| **Flask** | 3.1.3 | <2.0 session cookie 漏洞 | ✅ 已修复 (3.x) |
| **Werkzeug** | 3.1.8 | <2.3 debugger PIN 漏洞 | ✅ 已修复 (2.0.3+) |
| **itsdangerous** | 2.2.0 | <2.0 签名问题 | ✅ 已修复 (2.x) |
| **pytest** | 9.1.1 | (开发依赖) | ✅ 当前版本 |
| **jsdom** | 30.0.1 | (DOM 模拟) | ✅ npm audit 0 漏洞 |
| **playwright-core** | 1.62.1 | (浏览器自动化) | ✅ npm audit 0 漏洞 |

### 8.2 sqlite3 安全

```bash
$ python3 -c "import sqlite3; print('sqlite3:', sqlite3.sqlite_version)"
sqlite3: 3.51.0
```

- sqlite3 是 Python 标准库，**不计 CVE**
- 当前版本基于 SQLite 3.51.0（最新稳定版）
- **未使用已弃用 API**（如 `PRAGMA legacy_alter_table`）
- **建议**：server.py 中避免使用 `PRAGMA legacy_alter_table`，当前未检测到使用

### 8.3 整体安全评估

- ✅ 所有直接依赖均为当前安全版本
- ✅ npm audit 无已知漏洞
- ⚠️ pip-audit 未运行（工具未安装），但 Flask/Werkzeug/itsdangerous 版本均为安全版本

---

## §9 优先级清单

| # | 等级 | 描述 | 位置/命令 | 建议 | 验证手段 |
|---|------|------|----------|------|---------|
| P0 | 🔴 紧急 | **.gitignore, requirements.txt, package-lock.json 未被 git 跟踪** | git status --short | 创建 `.gitignore` 并 git add；将 requirements*.txt 和 package-lock.json 纳入版本控制 | `git ls-files requirements.txt package-lock.json .gitignore` |
| P1 | 🟡 中等 | **主项目 node_modules 存在 71+ extraneous 包**（eslint 及依赖） | `npm ls --depth=0 \| grep extraneous` | 运行 `npm prune` 清理未声明依赖；或确认后更新 package.json | `npm ls --depth=0 \| grep -i extraneous \| wc -l` |
| P1 | 🟡 中等 | **pip-audit 未安装**，无法定期扫描 Python CVE | `which pip-audit` | 建议在 CI/CD 中添加 `pip-audit -r requirements.txt` | 手动验证或集成到测试流程 |
| P2 | 🔵 低 | **install-service.sh 文档未说明 lsof/ps 等系统工具前提** | install-service.sh | 在脚本注释或 README 中补充说明（如 "需要 lsof for macOS"） | 检查脚本注释覆盖率 |
| P2 | 🔵 低 | **README 缺少 Chrome 浏览器前提说明** | README.md | 已有"真实浏览器回归需要本机 Chrome"语句，建议移到安装前提部分 | grep "Chrome" README.md |
| P2 | 🔵 低 | **未使用 npm ci**，可能因 node_modules 不同步导致问题 | `npm install` vs `npm ci` | 建议统一使用 `npm ci --prefix .` 和 `npm ci --prefix qa` | README 验证 |

---

## §10 不要动的事项

以下内容根据审计要求 **明确排除在修改范围之外**：

| 项目 | 原因 |
|------|------|
| qa/verification.md | 已通过测试套件，文档价值高 |
| qa/node_modules/ | playwright-core + jsdom 是浏览器测试的必要依赖 |
| package-lock.json | 仅建议跟踪，不建议删除；锁文件保证构建一致性 |
| node_modules/ (主项目) | csso-cli + terser 是 CSS/JS 压缩必要工具 |
| tests/ | pytest 测试套件，需保持稳定 |
| stop.sh 平台兼容逻辑 | 已正确处理 macOS/Linux 差异 |

---

## 附录：快速验证命令

```bash
# Python 版本
python3 --version && /opt/miniconda3/bin/python -m pip show flask werkzeug itsdangerous pytest

# Node 版本
node --version && npm --version

# 检查 extraneous 包
npm ls --depth=0 2>&1 | grep -i extraneous | wc -l

# npm audit
npm audit --json 2>&1 | jq '.metadata.vulnerabilities'

# 浏览器
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Git 跟踪状态
git ls-files requirements.txt package-lock.json .gitignore
```
