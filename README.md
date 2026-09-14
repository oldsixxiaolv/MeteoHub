# MeteoHub · 大气科学学术工作台

面向大气科学研究的中文个人工作台：成果库、研究问答、研究者目录、分层知识页面与项目看板。由吕亦航创建于中国科学院大气物理研究所。

## 已实现

- 成果新增、编辑、删除，关键词/年份/类型筛选、收藏；DOI 格式校验和外链。格式通过不代表 DOI 已向出版机构核实。
- 提问、回答、点赞；研究者资料目录、关注名单和个人资料。
- 分层知识页面，标题/文本/待办/代码块，自动保存、失败提示和重试，Markdown 导出。
- 项目任务表格与看板，任务名称、状态、截止日期和备注。
- Python 脚本编辑、示例与 `.py` 下载。此版本尚未集成 Python 运行时，运行按钮禁用；服务器不执行用户代码。
- 用户名/密码注册登录，密码哈希，HttpOnly 签名 cookie；SQLite 持久化和 revision 冲突检测。

**这是个人工作台，并非跨用户公开社区。** 每个账户拥有独立成果、问答和目录；关注不会通知其他用户，问答不会发布到公共信息流。匿名模式包含明确标注的虚构示例，不构成真实论文或科研结论。

## 启动

需要 Python 3.10+。在项目目录执行：

```bash
bash start.sh
```

打开 <http://127.0.0.1:8080>。脚本优先使用 `METEOHUB_PYTHON` 指定的解释器、项目 `.venv/bin/python`，再查找 `python3` / `python`。缺依赖时只在项目 `.venv` 中安装，不做全局安装。

```bash
METEOHUB_PYTHON=/path/to/python PORT=9000 bash start.sh
bash run-background.sh
bash status.sh
bash stop.sh
```

前台用 Ctrl+C 停止。后台脚本使用绝对 `server.py` 路径并记录 PID；停服要求命令路径和进程工作目录均匹配，不确定时拒绝发送信号。生产部署需要另行配置 WSGI、HTTPS、安全 cookie 和运维保障；本任务没有部署公网服务。

## 保存与旧数据

- 未登录：保存在当前浏览器的 `meteohub_state_v1_anon`。匿名笔记会在退出账户后恢复，不被账户状态覆盖。
- 登录：服务端 `data/meteohub.db` 为持久化来源；本机缓存按用户 ID 分开。保存失败保留原提交状态，编辑表单/知识块保留输入以便重试。409 冲突不会自动覆盖服务端，请复制或导出未保存内容后刷新。
- 初次拉取账户数据失败时，只展示该账户自己的既有缓存并禁止写入未知版本；不会用示例覆盖缓存。
- 旧 `meteohub_users` / `meteohub_articles` 中可识别的资料、文章自动合入匿名空间；密码字段不迁移。旧键保持原样。旧账号不能作为后端账号登录，请重新注册。
- 匿名数据不会自动上传到账户。导出 Markdown 可备份知识页面；迁移完整旧状态时，应先备份再按 `/api/state` 契约处理，不要直接覆盖已有账户内容。

`data/secret.key` 保存签名密钥；设置非空 `SECRET_KEY` 时优先使用环境变量。备份数据时保管好数据库和密钥。清除浏览器存储会删除匿名笔记，勿将“清除站点数据”当成普通刷新。

## API

| 请求 | 契约 |
| --- | --- |
| `POST /api/auth/register`、`login` | `{username,password}` → `{user:{id,username}}`；注册自动登录 |
| `GET /api/auth/me` | `{user:null或对象}` |
| `POST /api/auth/logout` | 清除会话 cookie |
| `GET /api/state` | `{state,revision}`；未登录 401 |
| `PUT /api/state` | `{state,revision}`；成功版本递增，冲突 409 |
| `GET /api/active-count` | `{active_count:int}`；30 秒滑动窗口内的匿名活跃计数 |
| `POST /api/track-active` | `{status:"ok"}`；匿名心跳（无 user_id） |
| `GET /api/code-runs` | `{count:int}`；历史 `/api/run-code` 调用总数（见下） |
| `POST /api/run-code`、`GET /api/run-code` | **410 Gone**——服务器端代码执行已下线；保留端点只为返回明确说明 |
| `GET /api/admin/stats`、`/api/admin/clear-history`、`/api/code-history` | **404 Not Found**——管理端点已下线 |

`state` 包含 `publications`、`questions`、`researchers`、`following`、`bookmarks`、`pages`、`projects` 数组及 `profile` 对象；知识空间还保存 `ui` 视图偏好。单用户状态上限 2 MiB（UTF-8），请求体额外留 16 KiB 容量。写 API 校验浏览器 Origin，静态文件有白名单，源码、数据库和日志不对外提供。

## 验证

```bash
python3 -m pip install -r requirements.txt -r requirements-dev.txt
python3 -m pytest tests/ -q
npm ci --prefix qa
bash qa/run-all.sh
```

真实浏览器回归需要本机 Chrome，并对**专用测试数据库服务**执行（会创建测试账户和数据）：

```bash
METEOHUB_TEST_URL=http://127.0.0.1:9000 \
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node qa/browser-integration.cjs
```

当前实测结果、复现命令及截图见 `qa/verification.md`。历史 `qa/backend-review.md` 是早期审查记录，不能代表当前通过状态。

## 限制

没有多人实时协作、公共社区、文件上传、密码找回、账户删除或运行 Python 的能力。当前使用 SQLite 和 Flask 开发服务器，未做并发容量承诺或公网压测。浏览器缓存不是多租户操作系统隔离，共享电脑上的浏览器数据应按本机资料保管。其他浏览器与辅助技术仍需专项验收。
