#!/usr/bin/env bash
# Sourced by the launchers; use a configured interpreter or a local venv.
select_python() {
    PYTHON_CMD=""
    local candidate
    for candidate in "${METEOHUB_PYTHON:-}" "$SCRIPT_DIR/.venv/bin/python" python3 python; do
        [ -n "$candidate" ] || continue
        if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 10))' 2>/dev/null; then
            PYTHON_CMD="$candidate"
            break
        fi
    done
    if [ -z "$PYTHON_CMD" ]; then
        echo "❌ 需要 Python 3.10+。可设置 METEOHUB_PYTHON=/path/to/python。" >&2
        return 1
    fi
    if ! "$PYTHON_CMD" -c 'import flask, itsdangerous' 2>/dev/null; then
        "$PYTHON_CMD" -m venv "$SCRIPT_DIR/.venv"
        PYTHON_CMD="$SCRIPT_DIR/.venv/bin/python"
        "$PYTHON_CMD" -m pip install -r "$SCRIPT_DIR/requirements.txt"
    fi
}
