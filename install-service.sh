#!/bin/bash

# 安装 MeteoHub 为系统服务
# 这样可以在开机时自动启动，并且更稳定

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

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
    echo "❌ 未找到 Python/Flask"
    exit 1
fi

# 创建 systemd 服务文件
SERVICE_FILE="/etc/systemd/system/meteohub.service"

echo "📝 创建系统服务..."

cat > /tmp/meteohub.service << EOF
[Unit]
Description=MeteoHub Web Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
Environment="PATH=/usr/local/bin:/usr/bin:/bin"
ExecStart=$PYTHON_CMD $SCRIPT_DIR/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 复制到 systemd 目录
sudo cp /tmp/meteohub.service $SERVICE_FILE

# 重载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable meteohub.service

# 启动服务
sudo systemctl start meteohub.service

echo ""
echo "✅ MeteoHub 系统服务已安装并启动！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌍 访问地址: http://120.46.134.210:8080"
echo ""
echo "📌 管理命令:"
echo "   查看状态: sudo systemctl status meteohub"
echo "   停止服务: sudo systemctl stop meteohub"
echo "   重启服务: sudo systemctl restart meteohub"
echo "   开机自启: sudo systemctl enable meteohub"
echo "   禁用自启: sudo systemctl disable meteohub"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
