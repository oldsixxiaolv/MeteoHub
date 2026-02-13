#!/bin/bash

echo "🔄 正在重启 MeteoHub 服务..."

# 停止现有服务
./stop.sh > /dev/null 2>&1

sleep 1

# 重新启动
./run-background.sh
