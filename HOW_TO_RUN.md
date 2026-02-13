# MeteoHub 运行指南

## 问题说明

**Live-server** 只能提供静态文件服务（HTML/CSS/JS），它**无法执行 Python 代码**。

要在网页中运行 Python 代码，必须要有后端服务（server.py）来处理代码执行请求。

---

## 解决方案（任选其一）

### ✅ 方案 A：后台运行（推荐，最简单）

运行一次，永久后台运行，关闭终端也不影响：

```bash
cd /root/git/Project_develop/MeteoHub

# 启动后台服务
./run-background.sh
```

启动成功后，访问：http://120.46.134.210:8080

**管理命令：**
```bash
./status.sh    # 查看运行状态
./stop.sh      # 停止服务
./restart.sh   # 重启服务
tail -f server.log  # 查看实时日志
```

---

### ✅ 方案 B：系统服务（最稳定，开机自启）

安装为系统服务，随系统启动自动运行：

```bash
cd /root/git/Project_develop/MeteoHub
sudo ./install-service.sh
```

**管理命令：**
```bash
sudo systemctl status meteohub   # 查看状态
sudo systemctl stop meteohub     # 停止
sudo systemctl start meteohub    # 启动
sudo systemctl restart meteohub  # 重启
```

---

### ✅ 方案 C：同时运行两个服务

如果你希望 live-server 提供前端，server.py 提供后端：

**终端 1 - 启动后端（先运行这个）：**
```bash
cd /root/git/Project_develop/MeteoHub
./run-background.sh
```

**终端 2 - 启动前端（可选）：**
```bash
cd /root/git/Project_develop/MeteoHub
live-server --port=8080
```

> 注意：如果两个服务都用 8080 端口会冲突，可以把 live-server 改成其他端口，比如 `--port=3000`

---

## 为什么不能只用 Live Server？

| 功能 | Live Server | server.py |
|------|-------------|-----------|
| 显示网页 | ✅ | ✅ |
| 运行 Python 代码 | ❌ | ✅ |
| 用户登录/注册 | ❌ | ✅ |
| 保存数据 | ❌ | ✅ |

**核心问题**：浏览器里的 JavaScript 无法直接运行你服务器上的 Python 代码，这是安全限制。

必须通过后端 API（server.py）来中转执行。

---

## 架构说明

```
用户浏览器  <--HTTP-->  Flask后端(server.py) <--执行--> Python解释器
                ↑                                   ↓
                └──── 返回代码运行结果 ──────────────┘
```

- **前端**（index.html）：你在浏览器中看到的界面
- **后端**（server.py）：处理 Python 代码执行、用户数据等
- **端口 8080**：前后端共用同一个端口（Flask 同时提供前端静态文件和后端 API）

---

## 快速检查

运行以下命令检查服务是否正常：

```bash
# 检查服务是否在运行
curl http://120.46.134.210:8080/api/active-count

# 测试代码运行
curl -X POST http://120.46.134.210:8080/api/run-code \
  -H "Content-Type: application/json" \
  -d '{"code": "print(\"Hello\")"}'
```

---

## 常见问题

**Q: 我运行了 `./run-background.sh`，但是访问不了？**
A: 检查防火墙是否开放 8080 端口：
```bash
sudo ufw allow 8080
# 或
sudo firewall-cmd --add-port=8080/tcp --permanent
```

**Q: 如何查看服务是否正常运行？**
A: 运行 `./status.sh` 或查看日志 `cat server.log`

**Q: 我想修改端口？**
A: 编辑 `server.py`，修改第 241 行的 `port=8080`
