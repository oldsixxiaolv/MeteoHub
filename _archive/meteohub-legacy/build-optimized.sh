#!/bin/bash
# MeteoHub 优化构建脚本
# 压缩 JS 和 CSS，减少网络传输量

set -e

echo "🚀 MeteoHub 优化构建"
echo "===================="

# 确保 terser 和 csso 可用
if [ ! -f "./node_modules/.bin/terser" ]; then
    echo "📦 安装依赖..."
    npm install terser csso-cli --save-dev
fi

# 备份当前文件
echo "📦 备份当前文件..."
mkdir -p backups
cp app.js backups/app.js.bak.$(date +%Y%m%d_%H%M%S)
cp workspace.js backups/workspace.js.bak.$(date +%Y%m%d_%H%M%S)
cp styles.css backups/styles.css.bak.$(date +%Y%m%d_%H%M%S)

# 压缩 JavaScript
echo "📦 压缩 JavaScript..."
./node_modules/.bin/terser app.js -o dist/app.min.js -c -m --comments "/license|copyright/i"
./node_modules/.bin/terser workspace.js -o dist/workspace.min.js -c -m --comments "/license|copyright/i"

# 压缩 CSS
echo "📦 压缩 CSS..."
./node_modules/.bin/csso styles.css --output dist/styles.min.css

# 输出结果
echo ""
echo "📊 压缩结果:"
echo "-----------"
echo "app.js:       $(wc -c < backups/app.js.bak.* | head -1 | tr -d ' ') -> $(wc -c < dist/app.min.js) bytes"
echo "workspace.js: $(wc -c < backups/workspace.js.bak.* | head -1 | tr -d ' ') -> $(wc -c < dist/workspace.min.js) bytes"
echo "styles.css:   $(wc -c < backups/styles.css.bak.* | head -1 | tr -d ' ') -> $(wc -c < dist/styles.min.css) bytes"

# 验证语法
echo ""
echo "✅ 验证语法..."
node --check app.js && echo "  app.js: OK"
node --check workspace.js && echo "  workspace.js: OK"

echo ""
echo "✨ 优化完成！"
