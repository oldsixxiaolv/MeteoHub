#!/bin/bash

echo "📊 MeteoHub 服务状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查进程
if pgrep -f "server.py" > /dev/null; then
    PID=$(pgrep -f "server.py")
    echo "✅ 服务状态: 运行中"
    echo "   进程 PID: $PID"
    echo ""
    echo "🌍 访问地址:"
    echo "   http://120.46.134.210:8080"
    echo ""
    echo "📈 运行时间:"
    ps -p $PID -o etime= 2>/dev/null || echo "   未知"
    echo ""
    echo "📝 最新日志:"
    tail -n 5 server.log 2>/dev/null || echo "   暂无日志"
else
    echo "❌ 服务状态: 未运行"
    echo ""
    echo "🚀 启动服务: ./run-background.sh"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
