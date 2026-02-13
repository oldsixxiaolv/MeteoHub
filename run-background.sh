#!/bin/bash

# MeteoHub 后台自动启动脚本
# 使用 nohup 让服务在后台持续运行

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 查找 Python
PYTHON_CMD=""
for cmd in python3 python /root/miniconda3/envs/guochuang/bin/python; do
    if command -v $cmd &> /dev/null; then
        if $cmd -c "import flask" 2>/dev/null; then
            PYTHON_CMD=$cmd
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "❌ 未找到 Flask，尝试自动安装..."
    pip3 install flask flask-cors -q 2>/dev/null || pip install flask flask-cors -q 2>/dev/null
    PYTHON_CMD="python3"
fi

# 检查是否已在运行
if pgrep -f "server.py" > /dev/null; then
    echo "⚠️  服务已经在后台运行"
    echo ""
    echo "🌍 访问地址: http://120.46.134.210:8080"
    echo "🛑 停止服务: ./stop.sh"
    exit 0
fi

# 使用 nohup 后台运行
echo "🚀 正在后台启动 MeteoHub 服务..."
nohup $PYTHON_CMD server.py > server.log 2>&1 &

sleep 2

# 检查是否启动成功
if pgrep -f "server.py" > /dev/null; then
    echo ""
    echo "✅ 服务已成功启动！"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  🌍 网站地址: http://120.46.134.210:8080"
    echo "  💻 代码平台: http://120.46.134.210:8080/#code"
    echo "  📝 日志文件: server.log"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📌 常用命令:"
    echo "   查看日志: tail -f server.log"
    echo "   停止服务: ./stop.sh"
    echo "   重启服务: ./restart.sh"
    echo ""
else
    echo "❌ 启动失败，请检查 server.log"
fi
