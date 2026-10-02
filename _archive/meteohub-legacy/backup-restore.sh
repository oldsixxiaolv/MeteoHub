#!/bin/bash
# MeteoHub 备份恢复脚本
# 用法: ./backup-restore.sh [restore|backup|list]

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

case "${1:-}" in
    restore)
        # Restore from .orig if it actually differs from the current file.
        # .orig files are byte-equal snapshots taken at minify-time; restoring
        # them when they match the current file is a no-op (and misleading).
        # Strategy:
        #   - If .orig exists AND differs from current → use it (real recovery).
        #   - If .orig exists but is identical → refuse, report no-op honestly.
        #   - Otherwise → nothing to restore from.
        if [ ! -f "app.js.orig" ] || [ ! -f "workspace.js.orig" ]; then
            echo "❌ 原始备份文件不存在（缺 app.js.orig 或 workspace.js.orig）"
            exit 1
        fi
        identical_app=0
        identical_ws=0
        if cmp -s app.js.orig app.js; then identical_app=1; fi
        if cmp -s workspace.js.orig workspace.js; then identical_ws=1; fi
        if [ $identical_app -eq 1 ] && [ $identical_ws -eq 1 ]; then
            echo "ℹ️  .orig 与当前文件完全一致（byte-equal），无需恢复"
            echo "   如需回退到更早版本，请使用 backups/ 目录下的时间戳备份："
            echo "     ls backups/"
            exit 0
        fi
        # At least one file differs → archive current state, then restore.
        cp app.js "$BACKUP_DIR/app.js.pre-restore.$TIMESTAMP"
        cp workspace.js "$BACKUP_DIR/workspace.js.pre-restore.$TIMESTAMP"
        cp app.js.orig app.js
        cp workspace.js.orig workspace.js
        echo "✅ 已恢复 .orig（恢复前快照已备份到 $BACKUP_DIR/*.pre-restore.$TIMESTAMP）"
        ;;
    backup)
        # 创建带时间戳的完整备份
        ARCHIVE="meteohub_backup_$TIMESTAMP.tar.gz"
        tar -czf "$BACKUP_DIR/$ARCHIVE" \
            app.js app.js.orig \
            workspace.js workspace.js.orig \
            styles.css styles.css.orig \
            server.py data/ 2>/dev/null || true
        echo "✅ 备份已创建: $BACKUP_DIR/$ARCHIVE"
        ;;
    list)
        # 列出可用备份
        echo "=== 可用的备份 ==="
        ls -la "$BACKUP_DIR" 2>/dev/null || echo "暂无备份"
        echo ""
        echo "=== 原始文件状态 ==="
        ls -la *.orig 2>/dev/null || echo "暂无原始备份"
        ;;
    *)
        echo "用法: $0 {restore|backup|list}"
        echo ""
        echo "  restore  - 恢复原始 .orig 文件"
        echo "  backup   - 创建完整备份"
        echo "  list     - 列出所有备份"
        exit 1
        ;;
esac
