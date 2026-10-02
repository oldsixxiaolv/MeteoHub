# _archive/

MeteoHub 旧平台代码归档目录，仅作历史回溯参考，不再维护。

## 归档原因

MeteoHub 原本是一个面向多用户的**学术交流 / 知识管理平台**
（后端 `server.py` + 前端 `app.js / workspace.js / styles.css / workspace.css` + 测试与运维脚本）。

本次重构把它改造为**个人学术站点**（作品集 + 博客 + 论文精读），
所有功能改为纯静态实现，不再依赖 Python 后端或 Node 构建链。

为方便以后回滚、查阅历史决策、或对照审计报告，
所有旧平台代码、脚本、审计文档一律移入本目录，**不删除**。

## 目录结构

```
_archive/
└── meteohub-legacy/           # 旧平台全部代码 + 资产 + 文档
```

> 注：旧 macOS 资源分叉文件（`._*` 元数据）也已归档，位于 `_archive/meteohub-legacy/`
> 下与原文件同名处，仅供回滚时还原原始编辑环境，**新站点不需要**。

## 归档内容清单

### 后端与前端代码

| 类别 | 文件 |
| --- | --- |
| Python 后端 | `server.py` |
| 前端脚本 | `app.js` (含 `.orig` 备份), `workspace.js` (含 `.orig` 备份) |
| 前端样式 | `styles.css` (含 `.orig` 备份), `workspace.css` |
| 入口页面 | `index.html` (旧 640 行 SPA) |

### 工具 / 运维脚本

`backup-restore.sh`, `build-optimized.sh`, `install-service.sh`,
`python-env.sh`, `restart.sh`, `run-background.sh`, `start.sh`,
`status.sh`, `stop.sh`

### 依赖与构建配置

`package.json`, `package-lock.json`,
`requirements.txt`, `requirements-dev.txt`,
完整的 `node_modules/` 目录（已忽略，但归档保留）

### 测试与质量保障

- `tests/` — 旧后端的 pytest 套件（认证、会话、限流、状态、静态资源、stop 脚本等）
- `qa/` — 旧前端 E2E 浏览器脚本、审计探针、桌面/移动截图证据
- `dist/` — 旧构建产物目录（minify 后）
- `backups/` — `*.bak.*` / `*.min.*` / `*.pre-restore.*` 备份文件

### 运行时数据

- `data/meteohub.db` — 旧平台 SQLite 数据库
- `data/secret.key` — 旧平台会话密钥

> 数据已保留但**新站点不再使用**。如果确认不再需要，请手动删除 `_archive/meteohub-legacy/data/`。

### Python / 测试缓存

`__pycache__/`, `.pytest_cache/`

### 审计与方案文档

| 文档 | 用途 |
| --- | --- |
| `DEPENDENCY_AUDIT.md` | 旧后端依赖审查 |
| `DOCS_AUDIT.md` | 旧平台文档体系审计 |
| `HOW_TO_RUN.md` | 旧平台启动 / 部署 / 维护手册 |
| `OPTIMIZATION_AUDIT.md` | 旧平台性能 / 体积优化审计 |
| `OPTIMIZATION_CHANGELOG.md` | 旧平台优化阶段变更日志 |
| `OPTIMIZATION_FINAL.md` | 旧平台优化收尾汇总 |
| `SECURITY_AUDIT_BACKEND.md` | 旧后端安全审计（限流、cookie、logger、DOI/ORCID 等） |
| `UX_AUDIT_FRONTEND.md` | 旧前端体验审计（a11y / focus / skeleton / 对比度等） |
| `server.log` | 旧平台最后一段运行日志 |

## 如何回滚到旧平台

> 仅在确实需要恢复多用户学术交流平台形态时执行。

1. **切回原目录布局**（使用 `git mv` 保留历史，`mv` 也可以）：

   ```bash
   # 在仓库根目录执行
   git mv _archive/meteohub-legacy/* .
   # 清理空的归档目录
   rmdir _archive/meteohub-legacy
   rmdir _archive
   ```

2. **恢复运行时数据**（如需）：

   ```bash
   mkdir -p data
   mv _archive/meteohub-legacy/data/meteohub.db data/
   mv _archive/meteohub-legacy/data/secret.key    data/
   ```

3. **恢复依赖环境**：

   ```bash
   mv _archive/meteohub-legacy/node_modules .
   pip install -r _archive/meteohub-legacy/requirements.txt
   ```

4. **按旧方式启动**：

   ```bash
   bash _archive/meteohub-legacy/start.sh
   # 或参考 _archive/meteohub-legacy/HOW_TO_RUN.md
   ```

5. **如要恢复** `server.log` 的写入位置，还需调整 `.gitignore` 之外的服务配置（参见旧 `HOW_TO_RUN.md`）。

## 注意事项

- 归档中所有 `.py` / `.js` / `.css` / `.html` 仍可读，但**不再维护**。
- `data/` 中含有真实数据库与密钥，**不要**公开仓库或截图分享。
- `node_modules/` 体量较大，回滚时如果不再需要可整体删除。
- macOS 资源分叉文件 (`._*`) 是系统生成的元数据，不影响阅读，可忽略。
