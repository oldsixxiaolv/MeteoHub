#!/usr/bin/env bash
# MeteoHub background launcher.
#
# Runs server.py under nohup, captures PID in server.pid, logs to server.log.
# Idempotent: refuses to start a second instance while one is already up.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
PID_FILE="$SCRIPT_DIR/server.pid"
LOG_FILE="$SCRIPT_DIR/server.log"

# Already running?
if [ -f "$PID_FILE" ]; then
    old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "${old_pid:-}" ] && kill -0 "$old_pid" 2>/dev/null; then
        echo "⚠️  服务已在后台运行 (PID $old_pid)"
        echo "   停止:  ./stop.sh"
        echo "   重启:  ./restart.sh"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

# Find a working Python. Reuse the same logic as start.sh.
source "$SCRIPT_DIR/python-env.sh"
select_python

echo "🚀 正在后台启动 MeteoHub 服务…"
HOST="$HOST" PORT="$PORT" \
    nohup "$PYTHON_CMD" "$SCRIPT_DIR/server.py" > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
disown "$NEW_PID" 2>/dev/null || true

# Wait briefly for the port to open or the process to die.
for _ in $(seq 1 20); do
    if ! kill -0 "$NEW_PID" 2>/dev/null; then
        echo "❌ 启动失败，请检查 $LOG_FILE"
        cat "$LOG_FILE" | tail -20
        rm -f "$PID_FILE"
        exit 1
    fi
    sleep 0.2
done

echo
echo "✅ 服务已启动！"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "  PID:        $NEW_PID"
echo "  网站地址:   http://$HOST:$PORT"
echo "  日志文件:   $LOG_FILE"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "常用命令:"
echo "   ./status.sh   # 查看状态"
echo "   ./stop.sh     # 停止服务"
echo "   ./restart.sh  # 重启服务"
echo "   tail -f $LOG_FILE"
