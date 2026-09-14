#!/usr/bin/env bash
# Install MeteoHub as a systemd user service so it auto-starts on login.
# Works on Linux systems running systemd. macOS / Windows: use
# run-background.sh via launchd / Task Scheduler instead.

set -euo pipefail
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if ! command -v systemctl >/dev/null 2>&1; then
    echo "❌ 此脚本仅支持 systemd 用户服务；macOS 请使用 run-background.sh。" >&2
    exit 1
fi
source "$SCRIPT_DIR/python-env.sh"
select_python
PYTHON_CMD="$(command -v "$PYTHON_CMD")"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8080}"
SERVICE_FILE="${HOME}/.config/systemd/user/meteohub.service"
mkdir -p "$(dirname "$SERVICE_FILE")"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=MeteoHub Web Service (user)
After=network.target

[Service]
Type=simple
WorkingDirectory="$SCRIPT_DIR"
Environment="HOST=$HOST"
Environment="PORT=$PORT"
ExecStart="$PYTHON_CMD" "$SCRIPT_DIR/server.py"
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

if command -v systemctl >/dev/null 2>&1; then
    systemctl --user daemon-reload
    systemctl --user enable meteohub.service
    systemctl --user start meteohub.service
    echo
    echo "✅ 已安装并启动 user-level systemd 服务"
    echo "   状态:  systemctl --user status meteohub"
    echo "   日志:  journalctl --user -u meteohub -f"
else
    echo "ℹ️  未检测到 systemctl，已写入服务单元文件：$SERVICE_FILE"
    echo "   请用你的 init 系统（OpenRC / runit / s6 等）启用它。"
fi

echo
echo "🌍 访问地址: http://$HOST:$PORT"
