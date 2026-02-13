#!/bin/bash

echo "🛑 正在停止 MeteoHub 服务..."

# 查找并停止 server.py
pkill -f "server.py" 2>/dev/null

sleep 1

if pgrep -f "server.py" > /dev/null; then
    echo "⚠️  服务未能完全停止，尝试强制停止..."
    pkill -9 -f "server.py" 2>/dev/null
fi

# 清理端口 8080
fuser -k 8080/tcp 2>/dev/null

echo "✅ 服务已停止"
