#!/usr/bin/env bash
# MeteoHub foreground launcher.
#
# Cross-platform: detects python3 / py / python on PATH (no hardcoded conda
# paths). Honors $HOST and $PORT (defaults: 127.0.0.1:8080). Installs missing
# Python deps into a project-local venv if needed.
#
# This script does NOT detach — stop it with Ctrl-C. For a background service
# use run-background.sh / install-service.sh.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"

echo
echo "🚀 MeteoHub 启动中…"
echo "=================="
echo

# ---- Pick a Python interpreter ----
source "$SCRIPT_DIR/python-env.sh"
select_python

echo "✅ Python: $($PYTHON_CMD -V 2>&1)"
echo "✅ Flask:  $($PYTHON_CMD -c 'from importlib.metadata import version; print(version("flask"))' 2>/dev/null || echo 'unknown')"
echo
echo "🌐 启动服务 (HOST=$HOST PORT=$PORT) …"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "  🌍 网站地址:  http://$HOST:$PORT"
echo "  📝 日志文件:  server.log (后台模式)"
echo
echo "  按 Ctrl+C 停止前台服务。"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Always invoke server.py by its absolute path so the running process is
# unambiguously ours — stop.sh relies on the absolute path matching.
HOST="$HOST" PORT="$PORT" exec "$PYTHON_CMD" "$SCRIPT_DIR/server.py"
