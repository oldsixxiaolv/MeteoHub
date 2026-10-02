#!/usr/bin/env bash
# Stop only THIS instance of the MeteoHub backend.
#
# Reads the PID from server.pid (set by run-background.sh) and stops exactly
# that process — but only after verifying:
#   1. PID is a positive integer (rules out empty / garbage / zero).
#   2. A process with that PID actually exists.
#   3. The process's argv mentions `server.py` AND
#   4. The process's *current working directory* is THIS project root.
#
# Verification of cwd uses (in order):
#   - /proc/$PID/cwd symlink on Linux (resolves to the actual cwd), then
#   - `lsof -a -p $PID -d cwd -F n` (portable: works on macOS / Linux), then
#     refusal if neither mechanism is available.
# If cwd cannot be verified we REFUSE to signal — better to fail safe than
# to kill an unrelated long-lived process that happens to have the same PID
# (Linux/macOS both reuse PIDs after a process exits).
#
# We never blanket pkill or fuser-kill port 8080 because other people's
# services may be listening on that port.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/server.pid"
SERVER_PY="$SCRIPT_DIR/server.py"

if [ ! -f "$PID_FILE" ]; then
    echo "ℹ️  没有运行中的服务（未找到 server.pid）"
    exit 0
fi

# Read PID, strip whitespace and NUL bytes; reject anything non-digit.
RAW="$(cat "$PID_FILE" 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "$RAW" ] || ! [[ "$RAW" =~ ^[1-9][0-9]*$ ]]; then
    echo "❌ server.pid 内容不是合法正整数 PID，拒绝操作: '$RAW'"
    rm -f "$PID_FILE"
    exit 1
fi
PID="$RAW"

# Process must exist.
if ! kill -0 "$PID" 2>/dev/null; then
    echo "ℹ️  记录在案的服务已不在运行（清理 PID 文件）"
    rm -f "$PID_FILE"
    exit 0
fi

# --- Step 1: extract argv (cmdline) for cross-check ---
CMDLINE=""
if [ -r "/proc/$PID/cmdline" ]; then
    # Linux: cmdline is NUL-separated.
    CMDLINE="$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null || true)"
else
    CMDLINE="$(ps -p "$PID" -o command= 2>/dev/null || true)"
fi

# Verify argv mentions `server.py`. If it doesn't, this is not our process.
case " $CMDLINE " in
    *"server.py"*) : ;;
    *)
        echo "❌ PID $PID 的命令行不包含 server.py (cmdline: $CMDLINE)"
        echo "   拒绝发送信号以避免误杀其他服务。请检查 server.pid。"
        exit 1
        ;;
esac

# --- Step 2: verify the process's current working directory is our project ---
# This is the critical check: PID reuse could land us on a process started by
# another user/project that happens to be running our server.py from a copy
# in their checkout. cwd resolves this.
PROC_CWD=""

# Linux: /proc/$PID/cwd is a symlink to the cwd.
if [ -L "/proc/$PID/cwd" ]; then
    PROC_CWD="$(readlink "/proc/$PID/cwd" 2>/dev/null || true)"
fi

# Portable: lsof on the cwd fd. lsof -F n prints paths prefixed with 'n'.
if [ -z "$PROC_CWD" ] && command -v lsof >/dev/null 2>&1; then
    # `-a` ANDs the predicates; `-d cwd` selects the cwd file descriptor.
    # `-F n` prints just the name field. We grep for the line that starts
    # with 'n' (skipping lines like 'p' for pid).
    PROC_CWD="$(lsof -a -p "$PID" -d cwd -F n 2>/dev/null \
        | awk '/^n/ {sub(/^n/, ""); print; exit}' || true)"
fi

# If we got a cwd, normalize and compare.
if [ -n "$PROC_CWD" ]; then
    NORM_CWD="$(cd "$PROC_CWD" 2>/dev/null && pwd || echo "$PROC_CWD")"
    NORM_SCRIPT_DIR="$(cd "$SCRIPT_DIR" 2>/dev/null && pwd || echo "$SCRIPT_DIR")"
    if [ "$NORM_CWD" != "$NORM_SCRIPT_DIR" ]; then
        echo "❌ PID $PID 的当前工作目录不是本项目"
        echo "   本项目: $NORM_SCRIPT_DIR"
        echo "   进程 cwd: $NORM_CWD"
        echo "   拒绝发送信号以避免误杀其他检查到同名 server.py 的进程。"
        exit 1
    fi
else
    echo "❌ 无法确定 PID $PID 的当前工作目录（既无 /proc 也没有 lsof）"
    echo "   拒绝发送信号——宁可让 stop 失败也不误杀其他服务。"
    exit 1
fi

# The launchers always use an absolute script path. Reject relative argv;
# never resolve another process's argv against this shell's directory.
case " $CMDLINE " in
    *" $SERVER_PY "*|*" \"$SERVER_PY\" "*) ;;
    *)
        echo "❌ PID $PID 未以本项目 server.py 的绝对路径启动，拒绝停止。"
        exit 1
        ;;
esac

echo "🛑 停止 MeteoHub 服务 (PID $PID, cwd 已核对)…"
kill "$PID" 2>/dev/null || true

# Wait up to 5s for graceful exit.
for _ in $(seq 1 25); do
    if ! kill -0 "$PID" 2>/dev/null; then
        rm -f "$PID_FILE"
        echo "✅ 服务已停止"
        exit 0
    fi
    sleep 0.2
done

echo "⚠️  未在 5 秒内退出，尝试 SIGKILL"
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "✅ 已强制停止"
