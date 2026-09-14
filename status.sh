#!/usr/bin/env bash
# Show MeteoHub service status. Reads only the PID we wrote — no pgrep tricks
# that could match unrelated processes whose argv happens to contain the
# string "server.py".

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

echo "📊 MeteoHub 服务状态"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$PID_FILE" ]; then
    PID="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
        echo "✅ 状态:   运行中"
        echo "   PID:    $PID"
        echo "   地址:   http://$HOST:$PORT"
        if command -v ps >/dev/null 2>&1; then
            echo "   启动:   $(ps -p "$PID" -o lstart= 2>/dev/null || echo '未知')"
        fi
        echo
        echo "📝 最近日志:"
        tail -n 5 "$LOG_FILE" 2>/dev/null || echo "   (暂无日志)"
    else
        echo "❌ 状态:   PID 文件存在但进程不在运行"
        rm -f "$PID_FILE"
    fi
else
    echo "❌ 状态:   未运行"
    echo
    echo "启动:  ./run-background.sh"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
