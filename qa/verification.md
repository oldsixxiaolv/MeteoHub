# MeteoHub 收尾验收

本记录对应当前工作区实现；未提交 Git、未部署公网、未迁移或删除已有用户数据库。历史审查报告只保留作过程记录。

## 实际结果

| 验证 | 命令 | 结果 |
| --- | --- | --- |
| Flask 回归 | `/opt/miniconda3/bin/python -m pytest tests/ -q` | 89 passed（含本轮新增 22 个：限流 7 + DOI/ORCID 7 + session/secret 5 + smoke 3） |
| DOM / Store 回归 | `bash qa/run-all.sh` | 12 PASS，0 FAIL |
| 真实 Chrome | `node qa/browser-integration.cjs` | 14 组流程通过，0 JavaScript 异常 |
| JS 语法 | `node --check app.js`、`node --check workspace.js` | 通过 |
| 启动脚本语法 | `bash -n start.sh run-background.sh stop.sh status.sh restart.sh install-service.sh python-env.sh` | 通过 |
| 启动实测 | 设置 `METEOHUB_PYTHON`、临时 `METEOHUB_DB`、独立端口后执行 `bash start.sh` | `/api/auth/me` 返回 200；测试后仅结束此测试进程 |
| 补充回归 | `node qa/test-11-store-identity.js`、`node qa/test-02-tree.js`、`node qa/test-07-failed-save.js` | 通过；覆盖最后的存储配额失败和单次迁移修复 |
| `npm run test:frontend` | `npm run test:frontend` | 通过 12 PASS（修复前：SyntaxError，node 不能跑 .sh） |
| `pip install -r requirements.txt` | `pip install --dry-run -r requirements.txt` | 通过（修复前：缺 werkzeug → ImportError） |
| backup-restore 诚实性 | `bash backup-restore.sh restore` | "byte-equal, 无需恢复" 退出码 0（修复前：误导 "已恢复原始文件"） |

环境：macOS，Python 3.13.9（`/opt/miniconda3/bin/python`），Node v26.8.1，本机 Google Chrome；测试依赖保存在项目 `qa/node_modules`。依赖重建用 `npm ci --prefix qa`，Python 测试依赖见 `requirements-dev.txt`。

`run-all.sh` 排除了四个没有断言、只打印观察信息的历史调试探针，避免把“程序退出码为0”误称成功验证。原有失败检测已改为真实行为断言：编辑节点、焦点和光标保持，失败内容留存/重试，以及重复挂载只有一个订阅；不再通过 `.catch` 数量或任意 DOM 新增数判断正确性。

## 覆盖与修复

- 数据库连接从当前 Flask 实例读取配置；两个实例交错读写以及重建实例不串库。测试签名密钥文件使用临时目录，避免覆盖安装密钥。
- 保存队列绑定账户 epoch；账户切换取消旧队列，迟到响应不能覆盖新账户 revision；401 不会把旧 mutator 应用于匿名空间。
- 退出恢复已有匿名笔记；首次拉取失败保留同账户缓存并禁止未知版本写入。409 不覆盖服务端。保存成功才更新提交状态和显示成功提示。
- localStorage 不可用/配额不足时匿名保存报错，不能虚报成功；旧资料和成果迁移不包含密码，保留原键且只迁移一次。
- 知识块自动保存保留节点、光标和焦点；Enter/空块 Backspace 正确移焦。取消延迟抢焦；切页前未保存输入能保留。失败可重试并可将当前草稿导出 Markdown。重复 mount 清理订阅。
- 成果 CRUD、DOI 格式校验、搜索与收藏；提问/回答；研究者目录新增/关注/详情；个人资料；分层页面；项目表格/看板/截止日期；浏览器刷新、退出再登录恢复。
- 原 Python→JS 动态执行器已移除。页面提供脚本编辑和下载，禁用运行，明确没有 Python 运行时和服务器代码执行。
- `[hidden]` 覆盖组件 display，修复登录后仍显示登录按钮。移动端侧栏可打开并在导航后关闭；桌面看板与390px移动页面无横向溢出。内容编辑不触发全局 G 键或 `/` 快捷键。
- 停服仅接受当前项目绝对 `server.py` 命令路径并核对目标进程 cwd；临时其他目录同名进程实测不会被误杀。启动脚本统一解释器选择和本地虚拟环境，重启不再忽略停服失败。

## 浏览器证据

流程列表与异常集合保存在 [browser-results.json](browser-results.json)。截图：

- [桌面概览](desktop-overview.png)（1440px 视口）
- [桌面知识空间 / 看板](desktop-workspace.png)
- [移动概览](mobile-overview.png)（390px 视口）
- [移动知识空间 / 看板](mobile-workspace.png)

脚本使用正常 UI 交互和真实 HTTP。失败保存通过拦截一次 PUT 返回503验证；401/409及延迟账户切换由独立 Store 回归精确控制时序。DOM 测试不能代替布局检查；截图另经人工式视觉检查。

## 预览与持久化启动

本轮验收预览为 `http://127.0.0.1:60237`，使用临时测试数据库，**不应在此保存正式研究资料**。运行信息在被 Git 忽略的 `qa/preview-runtime.json`。该预览未占用默认8080，也没有调用旧停服脚本。

用户正式运行：

```bash
cd /Volumes/Kingston/Mac/MeteoHub
METEOHUB_PYTHON=/opt/miniconda3/bin/python bash start.sh
```

默认访问 `http://127.0.0.1:8080`，正式数据持久化到项目 `data/meteohub.db`。不要携带测试环境的 `METEOHUB_DB`；完整说明见 [HOW_TO_RUN.md](../HOW_TO_RUN.md)。

重新运行端到端测试须使用专用测试服务：

```bash
METEOHUB_TEST_URL=http://127.0.0.1:9000 \
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node qa/browser-integration.cjs
```

## 已知边界

账户内私有工作台，不是跨用户公开社区；目录关注不发送通知，问答不向其他用户发布。Python 仅编辑/下载。没有多人实时协作、文件上传、密码找回、账户删除；冲突后需先复制/导出草稿再刷新，不自动合并。匿名数据依赖当前浏览器；账号本机缓存不等于操作系统级多用户隔离。未做生产负载、其他浏览器、屏幕阅读器专项测试，也未执行 systemd 安装或公网部署。
