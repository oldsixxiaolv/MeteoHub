# 运行 MeteoHub

## 本机前台

需要 Python 3.10+：

```bash
cd /path/to/MeteoHub
bash start.sh
```

浏览器打开 <http://127.0.0.1:8080>。Flask 同时提供网页和 API，不能只用静态文件服务代替账号后端。

指定解释器或其他端口：

```bash
METEOHUB_PYTHON=/path/to/python PORT=9000 bash start.sh
```

依赖缺失时脚本创建项目 `.venv` 并从 `requirements.txt` 安装；已有虚拟环境会复用。也可手动准备：

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python server.py
```

## 后台与状态

```bash
bash run-background.sh
bash status.sh
bash stop.sh
bash restart.sh
```

后台模式创建 `server.pid`、`server.log`。停服脚本校验 PID、绝对命令路径与目标工作目录；Linux 读取 `/proc`，macOS 使用 `lsof`。验证失败时拒绝停止，重启脚本也会停止执行。不要用 `pkill -f server.py` 杀其他项目。

Linux 的 systemd 用户服务可用 `bash install-service.sh` 安装。该命令会实际安装并启动服务；本轮未执行。macOS 不支持此 systemd 脚本。

## 配置

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听地址 |
| `PORT` | `8080` | 监听端口 |
| `METEOHUB_PYTHON` | 自动检测 | 启动脚本的 Python 解释器 |
| `METEOHUB_DB` | 项目内 `data/meteohub.db` | SQLite 数据库路径 |
| `SECRET_KEY` | 项目内持久化密钥 | 非空环境变量优先于 `data/secret.key` |

数据库父目录自动创建；自定义数据库不会改变其他 Flask 实例的数据库路径。所有服务实例需要各自妥善配置签名密钥。此版本默认服务仅用于本机，公网部署应单独配置生产 WSGI、HTTPS 与 cookie 安全策略。

## 独立验收环境

不要对真实账户库运行创建/删除数据的端到端测试。以下命令在临时目录创建专用测试库：

```bash
METEOHUB_TEST_DIR="$(mktemp -d)"
METEOHUB_DB="$METEOHUB_TEST_DIR/qa.db" SECRET_KEY=local-test-key PORT=9000 \
  .venv/bin/python server.py
```

另开终端：

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest tests/ -q
npm ci --prefix qa
bash qa/run-all.sh
METEOHUB_TEST_URL=http://127.0.0.1:9000 \
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node qa/browser-integration.cjs
```

Linux 可把 `CHROME_BIN` 指向 Chrome/Chromium 可执行文件。DOM 测试不能验证布局，真实浏览器脚本另外验证桌面和移动视口。历史纯打印探针不计入 `run-all.sh` 的通过数量。

## 数据与排错

- 匿名笔记只在当前浏览器；账号笔记在 SQLite；退出恢复原匿名空间。
- 拉取失败请检查服务和网络后刷新；409 请先复制或导出未保存文本再刷新。
- 页面缓存可用强制刷新解决，勿直接清除站点数据，以免删除匿名笔记。
- 端口占用时换 `PORT`，不要停止不明进程。
- 备份前保留原数据库与 `data/secret.key`；不要删除 `data/` 排查普通启动问题。
- Python 页面仅编辑/下载脚本，运行按钮禁用；没有服务器代码执行接口。

完整功能、状态 API 与迁移说明见 [README.md](README.md)。
