#!/bin/bash

# MeteoHub 全自动启动脚本
# 用法: ./start.sh
# 访问: http://localhost:8080

echo ""
echo "🚀 MeteoHub 启动中..."
echo "=================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 检查 Python
echo -e "${BLUE}📦 检查 Python 环境...${NC}"
PYTHON_CMD=""

# 尝试不同的 Python 命令
for cmd in python3 python /root/miniconda3/envs/guochuang/bin/python; do
    if command -v $cmd &> /dev/null; then
        if $cmd -c "import flask" 2>/dev/null; then
            PYTHON_CMD=$cmd
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}❌ 未找到安装了 Flask 的 Python 环境${NC}"
    echo ""
    echo "正在尝试自动安装 Flask..."
    
    # 尝试安装 Flask
    for pip_cmd in pip3 pip /root/miniconda3/envs/guochuang/bin/pip; do
        if command -v $pip_cmd &> /dev/null; then
            echo "使用 $pip_cmd 安装 Flask..."
            $pip_cmd install flask flask-cors -q
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ Flask 安装成功${NC}"
                # 重新检测
                for cmd in python3 python /root/miniconda3/envs/guochuang/bin/python; do
                    if command -v $cmd &> /dev/null; then
                        if $cmd -c "import flask" 2>/dev/null; then
                            PYTHON_CMD=$cmd
                            break
                        fi
                    fi
                done
                break
            fi
        fi
    done
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}❌ 无法找到或安装 Flask${NC}"
    echo "请手动安装: pip3 install flask flask-cors"
    exit 1
fi

echo -e "${GREEN}✅ Python: $PYTHON_CMD${NC}"
echo -e "${GREEN}✅ Flask 已安装${NC}"

echo ""
echo -e "${BLUE}🌐 启动服务...${NC}"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}🌍 网站地址:${NC} ${YELLOW}http://localhost:8080${NC}"
echo -e "  ${GREEN}💻 代码平台:${NC} ${YELLOW}http://localhost:8080/#code${NC}"
echo -e "  ${GREEN}🔐 管理后台:${NC} 连续点击左上角 Logo 5次"
echo -e "  ${GREEN}🔑 管理密码:${NC} Lyh200411"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📖 快速开始:"
echo "   1. 在浏览器中打开 http://localhost:8080"
echo "   2. 注册账号开始使用"
echo "   3. 点击'运行代码'使用 Python 平台"
echo "   4. 点击'投稿'分享你的研究成果"
echo ""
echo -e "⚠️  ${YELLOW}按 Ctrl+C 停止服务${NC}"
echo ""
echo "=================="
echo ""

# 启动服务器
exec $PYTHON_CMD server.py
