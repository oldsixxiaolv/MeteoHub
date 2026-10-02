#!/usr/bin/env python3
"""
MeteoHub backend.

Responsibilities
----------------
* Serve the static front-end (index.html, styles.css, workspace.css, app.js,
  workspace.js, favicon-style assets).
* Provide a small authenticated JSON API for account + per-user state:
    - POST /api/auth/register   {username, password}  -> {user:{id, username}}
    - POST /api/auth/login      {username, password}  -> {user:{id, username}}
    - POST /api/auth/logout                          -> {}
    - GET  /api/auth/me                              -> {user:null|{id, username}}
    - GET  /api/state                                -> {state, revision}
    - PUT  /api/state           {state, revision}    -> {state, revision}  (409 on conflict)
* Provide two anonymous aggregate counters that do NOT expose any user data:
    - GET  /api/active-count
    - GET  /api/code-runs

Design notes
------------
* Storage: a single SQLite file (default `./data/meteohub.db`). All writes are
  funnelled through short-lived transactions. Optimistic concurrency control on
  the `state` table uses a monotonic `revision` integer; PUT /api/state only
  succeeds when the caller's `revision` matches the stored one, otherwise it
  returns 409 with the current stored state.
* Passwords are hashed with `werkzeug.security.generate_password_hash`
  (pbkdf2:sha256 by default).
* Sessions are Flask signed cookies — `HttpOnly`, `SameSite=Lax`,
  `SECRET_KEY` from env or a generated-on-boot persistent file.
* Static files are served from a hard-coded allow-list of safe paths.
  Everything else (server.py, .git, *.db, *.log, requirements.txt, tests/, …)
  is rejected with 404 to keep them off the wire.
* The legacy "run Python code on the server" feature is intentionally REMOVED.
  Keyword filtering was never a security boundary and pretending otherwise would
  be dishonest. The endpoint is gone; clients that still POST to it get 410
  Gone with a clear explanation.

Run
---
    HOST=127.0.0.1 PORT=8080 SECRET_KEY=... python3 server.py
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import threading
import time
import uuid
from collections import deque
from contextlib import contextmanager
from typing import Any, Deque, Iterator

from flask import (
    Flask,
    current_app,
    has_app_context,
    abort,
    jsonify,
    make_response,
    request,
    send_from_directory,
)
from itsdangerous import BadSignature
from werkzeug.security import check_password_hash, generate_password_hash


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_DIR = os.path.join(BASE_DIR, "data")
DEFAULT_DB_PATH = os.path.join(DEFAULT_DB_DIR, "meteohub.db")

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8080"))
DB_PATH = os.environ.get("METEOHUB_DB", DEFAULT_DB_PATH)
SECRET_FILE = os.path.join(DEFAULT_DB_DIR, "secret.key")

# Input size limits (UTF-8 bytes).
# PUT /api/state bodies may legitimately be a few MB once a user's knowledge
# base grows, so the JSON body limit must comfortably exceed the state limit.
# We size the JSON envelope 1 KiB larger than the state payload to leave room
# for {"state": …, "revision": N} framing, then add a few KiB of headroom.
MAX_STATE_BYTES = 2 * 1024 * 1024                  # 2 MiB of actual UTF-8 state
MAX_JSON_BODY = MAX_STATE_BYTES + 16 * 1024        # state + 16 KiB of envelope
MAX_USERNAME = 64
MAX_PASSWORD = 256
SESSION_COOKIE_NAME = "meteohub_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 14  # 14 days

# Static allow-list. Anything not matched returns 404.
STATIC_ALLOWLIST = {
    "",            # serves index.html
    "index.html",
    "styles.css",
    "workspace.css",
    "app.js",
    "workspace.js",
    "favicon.ico",
    "favicon.svg",
    "manifest.json",
}
STATIC_ASSET_PREFIXES = ("assets/", "img/")


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

_db_lock = threading.Lock()


def _database_path() -> str:
    return current_app.config["METEOHUB_DB"] if has_app_context() else DB_PATH


def _ensure_data_dir() -> None:
    d = os.path.dirname(_database_path())
    if d and not os.path.isdir(d):
        os.makedirs(d, exist_ok=True)


def _get_secret_key() -> bytes:
    """Stable per-install signing key.

    Resolution order:
      1. ``SECRET_KEY`` environment variable — takes precedence, lets operators
         pin the key (e.g. in a systemd ``EnvironmentFile``).
      2. ``data/secret.key`` next to the database — auto-generated on first
         boot, persisted with 0600 permissions.

    The env var must be non-empty once stripped; empty / whitespace-only
    values are ignored so a forgotten export can't accidentally mint an
    insecure key.
    """
    env_key = os.environ.get("SECRET_KEY", "").strip()
    if env_key:
        return env_key.encode("utf-8")
    _ensure_data_dir()
    if os.path.exists(SECRET_FILE):
        with open(SECRET_FILE, "rb") as f:
            key = f.read().strip()
        if key:
            return key
    key = uuid.uuid4().hex.encode("utf-8") + uuid.uuid4().hex.encode("utf-8")
    with open(SECRET_FILE, "wb") as f:
        f.write(key)
    try:
        os.chmod(SECRET_FILE, 0o600)
    except OSError as e:
        # Non-POSIX filesystems (e.g. Windows, some bind mounts) can't enforce
        # 0o600. Surface a warning so operators notice the security downgrade
        # instead of silently trusting that the file is locked down.
        # Logging before app context exists is fine — stdlib logging goes to
        # stderr by default and is captured by run-background.sh into server.log.
        import logging
        logging.getLogger("meteohub").warning(
            "secret.key chmod 0600 failed (%s); file may be readable by other users", e
        )
    return key


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS state (
    user_id  INTEGER PRIMARY KEY,
    revision INTEGER NOT NULL,
    payload  TEXT NOT NULL,
    updated_at REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS code_runs (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    at    REAL NOT NULL
);
"""


@contextmanager
def db_conn() -> Iterator[sqlite3.Connection]:
    _ensure_data_dir()
    conn = sqlite3.connect(_database_path(), timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with _db_lock, db_conn() as conn:
        conn.executescript(SCHEMA)
        # Migrations: small additive changes that don't belong to the base
        # schema. CREATE INDEX IF NOT EXISTS is idempotent — safe to run on
        # existing databases (added in MeteoHub v2.x for /api/code-runs perf).
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_code_runs_at ON code_runs(at)"
        )


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------


def make_session_cookie(user_id: int) -> str:
    """Return a signed token carrying the user_id."""
    from itsdangerous import URLSafeTimedSerializer
    s = URLSafeTimedSerializer(_get_secret_key(), salt="meteohub-session")
    return s.dumps({"uid": user_id})


def read_session_cookie(token: str) -> int | None:
    if not token:
        return None
    try:
        from itsdangerous import URLSafeTimedSerializer
        s = URLSafeTimedSerializer(_get_secret_key(), salt="meteohub-session")
        data = s.loads(token, max_age=SESSION_MAX_AGE)
        uid = data.get("uid")
        return int(uid) if isinstance(uid, int) else None
    except BadSignature:
        return None
    except Exception:
        return None


def current_user_id() -> int | None:
    token = request.cookies.get(SESSION_COOKIE_NAME, "")
    return read_session_cookie(token)


# ---------------------------------------------------------------------------
# Aggregate counters (anonymous)
# ---------------------------------------------------------------------------

_active_lock = threading.Lock()
_active: dict[str, float] = {}
_ACTIVE_TTL = 30.0


def record_active() -> None:
    """Anonymous touch — no user id, no IP. Just a 'something hit the page' tick."""
    key = uuid.uuid4().hex
    now = time.time()
    with _active_lock:
        _active[key] = now
        cutoff = now - _ACTIVE_TTL
        stale = [k for k, t in _active.items() if t < cutoff]
        for k in stale:
            _active.pop(k, None)


def active_count() -> int:
    now = time.time()
    with _active_lock:
        cutoff = now - _ACTIVE_TTL
        return sum(1 for t in _active.values() if t >= cutoff)


def bump_code_runs() -> None:
    try:
        with _db_lock, db_conn() as conn:
            conn.execute("INSERT INTO code_runs(at) VALUES (?)", (time.time(),))
    except sqlite3.OperationalError:
        pass


def code_runs_total() -> int:
    try:
        with db_conn() as conn:
            cur = conn.execute("SELECT COUNT(*) AS n FROM code_runs")
            return int(cur.fetchone()["n"])
    except sqlite3.OperationalError:
        return 0


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _bad(msg: str, code: int = 400):
    return make_response(jsonify({"error": msg}), code)


def _bad_with_retry_after(msg: str, retry_after: int, code: int = 429):
    """Build a 429 response with a Retry-After header (seconds)."""
    resp = make_response(jsonify({"error": msg}), code)
    resp.headers["Retry-After"] = str(max(1, retry_after))
    return resp


def _is_str(v: Any) -> bool:
    return isinstance(v, str)


def _bounded_str(v: Any, *, field: str, max_len: int) -> str | None:
    if not _is_str(v):
        return f"{field} 必须是字符串"
    if len(v) == 0:
        return f"{field} 不能为空"
    if len(v) > max_len:
        return f"{field} 长度不能超过 {max_len} 字符"
    return None


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app(db_path: str | None = None) -> Flask:
    """Build a Flask app. Tests pass a temp db_path; production uses the module default."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["MAX_CONTENT_LENGTH"] = MAX_JSON_BODY
    app.config["METEOHUB_DB"] = os.path.abspath(db_path or DB_PATH)

    # Disable Flask's built-in `/static/<path:filename>` route entirely.
    # If we leave it on, any file dropped into a `static/` subfolder of the
    # project would be served — bypassing our allow-list. We replace the
    # endpoint with a 404 so the route exists (no surprise routing) but never
    # delivers a file.
    from flask import abort as _flask_abort
    app.view_functions["static"] = (
        lambda *_a, **_kw: _flask_abort(404)
    )
    app.static_folder = None
    app.static_url_path = None

    with app.app_context():
        init_db()

    # -----------------------------------------------------------------
    # Security headers on every response.
    # -----------------------------------------------------------------
    @app.after_request
    def _security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
        )
        return resp

    # -----------------------------------------------------------------
    # Same-origin write guard. Runs before any mutating endpoint; cheap when
    # the request carries no Origin header (curl, server-to-server).
    # -----------------------------------------------------------------
    _WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    @app.before_request
    def _guard_origin():
        if request.method not in _WRITE_METHODS:
            return None
        # Only enforce on /api/* — static GETs are safe regardless of origin.
        if not request.path.startswith("/api/"):
            return None
        origin = request.headers.get("Origin")
        if not origin:
            # No Origin = non-browser client (curl, native, server-side).
            # The SameSite=Lax cookie already blocks browser cross-site POSTs,
            # so this is a defense-in-depth check, not the only line.
            return None
        try:
            from urllib.parse import urlparse
            o = urlparse(origin)
        except Exception:
            return _bad("Origin 校验失败", 403)
        if not o.hostname:
            return _bad("Origin 校验失败", 403)
        request_host = (request.host or "").split(":")[0].lower()
        allowed_hosts = {request_host, "127.0.0.1", "localhost", HOST}
        if o.hostname.lower() not in allowed_hosts:
            return _bad("跨源写入被拒绝", 403)
        return None

    # -----------------------------------------------------------------
    # Static files (allow-list only)
    # -----------------------------------------------------------------
    @app.route("/", methods=["GET"])
    def root():
        return send_from_directory(BASE_DIR, "index.html")

    @app.route("/<path:filename>", methods=["GET"])
    def static_file(filename: str):
        # Normalize: reject traversal and absolute paths.
        if (
            not filename
            or filename.startswith("/")
            or "\\" in filename
            or ".." in filename.split("/")
        ):
            abort(404)
        # Asset-folder prefix: we allow anything in assets/, img/ — but
        # we still strip obviously dangerous extensions (no .py, .db, .log,
        # etc. inside asset folders) so dropping a stray file in there
        # can't be used to leak code or data.
        if any(filename.startswith(p) for p in STATIC_ASSET_PREFIXES):
            base = filename.rsplit("/", 1)[-1]
            _blocked_ext = (
                ".py", ".db", ".db-journal", ".db-wal", ".db-shm",
                ".log", ".key", ".env", ".sqlite", ".sqlite3",
            )
            if any(filename.endswith(ext) for ext in _blocked_ext):
                abort(404)
            # Make sure the resolved file actually lives under BASE_DIR — the
            # `..` check above is path-segment, this is the resolved path.
            target = os.path.normpath(os.path.join(BASE_DIR, filename))
            if not target.startswith(BASE_DIR + os.sep):
                abort(404)
            return send_from_directory(BASE_DIR, filename)
        # Allow-list: exact match (top-level file).
        if filename in STATIC_ALLOWLIST:
            target = os.path.normpath(os.path.join(BASE_DIR, filename))
            if not target.startswith(BASE_DIR + os.sep):
                abort(404)
            return send_from_directory(BASE_DIR, filename)
        # Explicit denials — keep these off the wire even if a future
        # maintainer adds them to the repo by accident.
        forbidden = (
            "server.py", "requirements.txt",
            "HOW_TO_RUN.md", "README.md", "LICENSE",
            ".env", ".git", ".gitignore",
        )
        if filename in forbidden or filename.startswith(".git") \
                or filename.endswith(".py") or filename.endswith(".db") \
                or filename.endswith(".db-journal") or filename.endswith(".db-wal") \
                or filename.endswith(".db-shm") \
                or filename.endswith(".log") or filename.endswith(".key") \
                or filename.startswith("tests/") or filename == "tests":
            abort(404)
        abort(404)

    # -----------------------------------------------------------------
    # Auth
    # -----------------------------------------------------------------
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        allowed, retry = _rate_limit_check("auth_register")
        if not allowed:
            return _bad_with_retry_after("请求过于频繁，请稍后再试", retry)
        data, err = _json_body()
        if err is not None:
            return err
        username_err = _bounded_str(data.get("username"), field="username", max_len=MAX_USERNAME)
        password_err = _bounded_str(data.get("password"), field="password", max_len=MAX_PASSWORD)
        if username_err:
            return _bad(username_err)
        if password_err:
            return _bad(password_err)
        username = data["username"].strip()
        password = data["password"]
        if len(username) < 3:
            return _bad("用户名至少 3 个字符")
        if len(password) < 6:
            return _bad("密码至少 6 个字符")
        # Username charset: ASCII letters/digits/_/-, keep it boring.
        for ch in username:
            if not (ch.isascii() and (ch.isalnum() or ch in "_-")):
                return _bad("用户名只能包含字母、数字、下划线和短横线")
        pw_hash = generate_password_hash(password)
        now = time.time()
        with _db_lock, db_conn() as conn:
            try:
                cur = conn.execute(
                    "INSERT INTO users(username, password_hash, created_at) VALUES (?, ?, ?)",
                    (username, pw_hash, now),
                )
            except sqlite3.IntegrityError:
                return _bad("用户名已被占用", 409)
            user_id = int(cur.lastrowid)
            conn.execute(
                "INSERT INTO state(user_id, revision, payload, updated_at) VALUES (?, 0, ?, ?)",
                (user_id, _empty_state_json(), now),
            )
        resp = make_response(jsonify({"user": {"id": user_id, "username": username}}), 201)
        _set_session_cookie(resp, user_id)
        return resp

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        allowed, retry = _rate_limit_check("auth_login")
        if not allowed:
            return _bad_with_retry_after("请求过于频繁，请稍后再试", retry)
        data, err = _json_body()
        if err is not None:
            return err
        username_err = _bounded_str(data.get("username"), field="username", max_len=MAX_USERNAME)
        password_err = _bounded_str(data.get("password"), field="password", max_len=MAX_PASSWORD)
        if username_err:
            return _bad(username_err)
        if password_err:
            return _bad(password_err)
        username = data["username"].strip()
        password = data["password"]
        with _db_lock, db_conn() as conn:
            row = conn.execute(
                "SELECT id, username, password_hash FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        # Always run the hash check even on miss to keep timing similar.
        if row is None:
            check_password_hash(
                "pbkdf2:sha256:600000$dummy$" + "0" * 64,
                password,
            )
            return _bad("用户名或密码错误", 401)
        if not check_password_hash(row["password_hash"], password):
            return _bad("用户名或密码错误", 401)
        resp = make_response(jsonify({"user": {"id": row["id"], "username": row["username"]}}), 200)
        _set_session_cookie(resp, row["id"])
        return resp

    @app.route("/api/auth/logout", methods=["POST"])
    def logout():
        resp = make_response(jsonify({}), 200)
        resp.delete_cookie(SESSION_COOKIE_NAME)
        return resp

    @app.route("/api/auth/me", methods=["GET"])
    def me():
        uid = current_user_id()
        if uid is None:
            return jsonify({"user": None})
        with db_conn() as conn:
            row = conn.execute(
                "SELECT id, username FROM users WHERE id = ?", (uid,),
            ).fetchone()
        if row is None:
            return jsonify({"user": None})
        return jsonify({"user": {"id": row["id"], "username": row["username"]}})

    # -----------------------------------------------------------------
    # State
    # -----------------------------------------------------------------
    @app.route("/api/state", methods=["GET"])
    def state_get():
        uid = current_user_id()
        if uid is None:
            return _bad("未登录", 401)
        # The cookie may still be valid up to 14 days after the user is
        # removed (admin delete, data import, etc.). Verify the user still
        # exists — otherwise behave exactly like an unauthenticated request.
        if not _resolve_user(uid):
            return _bad("未登录", 401)
        with _db_lock, db_conn() as conn:
            row = conn.execute(
                "SELECT revision, payload FROM state WHERE user_id = ?", (uid,),
            ).fetchone()
            if row is None:
                # Idempotent auto-init: use INSERT OR IGNORE so two concurrent
                # first-GETs don't both try to insert the same user_id row
                # (the second would fail with UNIQUE and 500).
                conn.execute(
                    "INSERT OR IGNORE INTO state(user_id, revision, payload, updated_at) "
                    "VALUES (?, 0, ?, ?)",
                    (uid, _empty_state_json(), time.time()),
                )
                row = conn.execute(
                    "SELECT revision, payload FROM state WHERE user_id = ?", (uid,),
                ).fetchone()
        try:
            payload = json.loads(row["payload"])
        except json.JSONDecodeError:
            payload = _empty_state()
        if not _is_valid_state(payload):
            payload = _empty_state()
        return jsonify({"state": payload, "revision": int(row["revision"])})

    @app.route("/api/state", methods=["PUT"])
    def state_put():
        allowed, retry = _rate_limit_check("state_put")
        if not allowed:
            return _bad_with_retry_after("请求过于频繁，请稍后再试", retry)
        uid = current_user_id()
        if uid is None:
            return _bad("未登录", 401)
        # Stale cookie → deleted user: refuse before touching the DB.
        if not _resolve_user(uid):
            return _bad("未登录", 401)
        # Same-origin Origin check is enforced by the app-wide before_request
        # hook — no need to call it here.
        # Reject oversized raw bodies up front — MAX_CONTENT_LENGTH already does
        # this for trusted clients, but Flask returns 413 by itself. We also
        # count the actual UTF-8 bytes of the serialized state payload below.
        data, err = _json_body()
        if err is not None:
            return err
        if not isinstance(data, dict):
            return _bad("请求体必须是 JSON 对象", 400)
        new_state = data.get("state")
        if not _is_valid_state(new_state):
            return _bad("state 字段结构不合法", 400)
        # Server-side DOI / ORCID format check — prevents bypassing the
        # frontend regex via raw PUT. Skipped when fields are missing/empty.
        id_err = _validate_identifiers(new_state)
        if id_err is not None:
            return _bad(id_err, 400)
        rev = data.get("revision")
        if not isinstance(rev, int) or isinstance(rev, bool) or rev < 0:
            return _bad("revision 必须是非负整数", 400)
        # Size check: actual UTF-8 bytes of the state payload, NOT
        # json.dumps()'s default ASCII escape length. JSON allows non-ASCII
        # text in strings and a Chinese-heavy knowledge base should size by
        # the real on-wire bytes.
        serialized = json.dumps(new_state, separators=(",", ":"), ensure_ascii=False)
        if len(serialized.encode("utf-8")) > MAX_STATE_BYTES:
            return _bad(
                f"state 体积不能超过 {MAX_STATE_BYTES} 字节（UTF-8 实际字节）",
                413,
            )
        now = time.time()
        with _db_lock, db_conn() as conn:
            row = conn.execute(
                "SELECT revision, payload FROM state WHERE user_id = ?", (uid,),
            ).fetchone()
            if row is None:
                # Same idempotent INSERT OR IGNORE pattern as state_get; the
                # revision starts at 1 regardless of how many concurrent writers
                # hit this branch.
                conn.execute(
                    "INSERT OR IGNORE INTO state(user_id, revision, payload, updated_at) "
                    "VALUES (?, 1, ?, ?)",
                    (uid, serialized, now),
                )
                # Re-read in case another writer already inserted (race).
                row2 = conn.execute(
                    "SELECT revision, payload FROM state WHERE user_id = ?", (uid,),
                ).fetchone()
                if row2 and int(row2["revision"]) == 1 and row2["payload"] == serialized:
                    return jsonify({"state": new_state, "revision": 1})
                # Otherwise we lost the race — fall through to the OCC check.
                row = row2
                if row is None:
                    # Extremely unlikely (deleted between SELECT and INSERT).
                    return _bad("未登录", 401)
            current_rev = int(row["revision"])
            if current_rev != rev:
                try:
                    cur_payload = json.loads(row["payload"])
                except json.JSONDecodeError:
                    cur_payload = _empty_state()
                if not _is_valid_state(cur_payload):
                    cur_payload = _empty_state()
                return make_response(
                    jsonify({
                        "error": "版本冲突",
                        "state": cur_payload,
                        "revision": current_rev,
                    }),
                    409,
                )
            new_rev = current_rev + 1
            conn.execute(
                "UPDATE state SET revision = ?, payload = ?, updated_at = ? "
                "WHERE user_id = ? AND revision = ?",
                (new_rev, serialized, now, uid, current_rev),
            )
            if conn.total_changes == 0:
                # Lost the race against another writer.
                row2 = conn.execute(
                    "SELECT revision, payload FROM state WHERE user_id = ?", (uid,),
                ).fetchone()
                try:
                    cur_payload = json.loads(row2["payload"]) if row2 else _empty_state()
                except json.JSONDecodeError:
                    cur_payload = _empty_state()
                if not _is_valid_state(cur_payload):
                    cur_payload = _empty_state()
                return make_response(
                    jsonify({
                        "error": "版本冲突",
                        "state": cur_payload,
                        "revision": int(row2["revision"]) if row2 else 0,
                    }),
                    409,
                )
        return jsonify({"state": new_state, "revision": new_rev})

    # -----------------------------------------------------------------
    # Anonymous aggregate counters
    # -----------------------------------------------------------------
    @app.route("/api/active-count", methods=["GET"])
    def api_active_count():
        return jsonify({"active_count": active_count()})

    @app.route("/api/track-active", methods=["POST"])
    def api_track_active():
        record_active()
        return jsonify({"status": "ok"})

    @app.route("/api/code-runs", methods=["GET"])
    def api_code_runs():
        return jsonify({"count": code_runs_total()})

    # -----------------------------------------------------------------
    # Legacy dangerous endpoints — explicitly removed.
    # -----------------------------------------------------------------
    @app.route("/api/run-code", methods=["POST", "GET"])
    def api_run_code_gone():
        bump_code_runs()  # keep the anonymous counter advancing for old clients
        return _bad(
            "服务器端代码执行功能已下线。"
            "关键词过滤从来不是真正的沙箱，已移除。请改用浏览器内 Python 工作区。",
            410,
        )

    @app.route("/api/admin/stats", methods=["GET"])
    @app.route("/api/admin/clear-history", methods=["POST"])
    @app.route("/api/code-history", methods=["GET"])
    def api_admin_gone():
        return _bad("管理端点已下线", 404)

    # -----------------------------------------------------------------
    # Error handlers — never leak stack traces
    # -----------------------------------------------------------------
    @app.errorhandler(404)
    def not_found(_e):
        if request.path.startswith("/api/"):
            return _bad("接口不存在", 404)
        return _bad("资源不存在", 404)

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return _bad("方法不被允许", 405)

    @app.errorhandler(413)
    def too_large(_e):
        return _bad("请求体过大", 413)

    @app.errorhandler(500)
    def server_error(_e):
        # Log the full traceback via Flask's logger so it ends up wherever the
        # operator configured (stderr in dev, server.log in background mode via
        # run-background.sh). Never leak stack details to the client.
        try:
            current_app.logger.exception(
                "500 at %s %s", request.method, request.path
            )
        except Exception:
            # Logger unavailable (e.g. outside app context) — last-resort stderr.
            import traceback
            traceback.print_exc()
        return _bad("服务器内部错误", 500)

    return app


# ---------------------------------------------------------------------------
# Module-level helpers used by routes above
# ---------------------------------------------------------------------------

_STATE_TOP_LEVEL = (
    "publications", "questions", "researchers",
    "following", "bookmarks", "profile", "pages", "projects",
)


# ---------------------------------------------------------------------------
# Rate limiting (in-memory sliding window)
# ---------------------------------------------------------------------------
# Per-IP sliding window. Keyed by IP; resolved from `request.remote_addr` and,
# when `TRUST_PROXY=1` is set, from the first hop of `X-Forwarded-For`. The
# window uses a deque of timestamps; older entries are trimmed on each check.
# Memory is bounded because we drop entries older than the window as we touch
# them, not via a global sweep.
#
# Limits are conservative defaults — operators who want to tune them can edit
# the constants below. Tests can clear the buckets via _rate_limit_reset().
_rate_limit_lock = threading.Lock()
_rate_limits: dict[tuple[str, str], Deque[float]] = {}


# Per-endpoint budget: (max_requests, window_seconds)
_RATE_LIMITS = {
    "auth_login": (5, 60),
    "auth_register": (5, 60),
    "state_put": (30, 60),
}


def _client_ip() -> str:
    """Best-effort client IP. Trusts X-Forwarded-For only when explicitly enabled."""
    if os.environ.get("TRUST_PROXY", "").strip() == "1":
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            # First entry is the originating client.
            return xff.split(",", 1)[0].strip()
    return request.remote_addr or "unknown"


def _rate_limit_check(endpoint: str) -> tuple[bool, int]:
    """Return (allowed, retry_after_seconds). Updates the bucket."""
    limit, window = _RATE_LIMITS[endpoint]
    key = (endpoint, _client_ip())
    now = time.time()
    cutoff = now - window
    with _rate_limit_lock:
        bucket = _rate_limits.get(key)
        if bucket is None:
            bucket = deque()
            _rate_limits[key] = bucket
        # Trim entries older than the window.
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window - (now - bucket[0])))
            return False, retry_after
        bucket.append(now)
        return True, 0


def _rate_limit_reset() -> None:
    """Test hook: clear all rate-limit buckets."""
    with _rate_limit_lock:
        _rate_limits.clear()


def _empty_state() -> dict[str, Any]:
    return {k: ([] if k != "profile" else {}) for k in _STATE_TOP_LEVEL}


def _empty_state_json() -> str:
    return json.dumps(_empty_state(), separators=(",", ":"), ensure_ascii=False)


def _check_depth(v: Any, current: int = 0) -> bool:
    """Recursively verify JSON nesting depth is within MAX_STATE_DEPTH.

    Returns False if any branch exceeds the limit. Strings, numbers, bools,
    None count as leaves; dicts and lists increment the depth counter.
    """
    if current > MAX_STATE_DEPTH:
        return False
    if isinstance(v, dict):
        for value in v.values():
            if not _check_depth(value, current + 1):
                return False
    elif isinstance(v, list):
        for item in v:
            if not _check_depth(item, current + 1):
                return False
    return True


def _is_valid_state(v: Any) -> bool:
    if not isinstance(v, dict):
        return False
    for key in _STATE_TOP_LEVEL:
        if key not in v:
            return False
        val = v[key]
        if key == "profile":
            if not isinstance(val, dict):
                return False
        else:
            if not isinstance(val, list):
                return False
    # Reject pathological nesting before it costs CPU / RecursionError.
    if not _check_depth(v):
        return False
    return True


# Server-side validation of well-known identifiers. Mirrors the regex used in
# app.js.orig:24-25 so a user can't bypass client validation by crafting a PUT
# request directly. Empty / missing values are skipped (a publication can omit
# doi, a researcher can omit orcid) — we only validate fields that are present.
_DOI_REGEX = re.compile(r"^10\.\d{4,9}/[-._;()/:A-Z0-9]+$", re.IGNORECASE)
_ORCID_REGEX = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")


def _validate_identifiers(state: Any) -> str | None:
    """Return an error message if any identifier in the state is malformed,
    otherwise None. Walks publications[].doi and researchers[].orcid only —
    mirrors what the frontend UI exposes and validates."""
    if not isinstance(state, dict):
        return None
    pubs = state.get("publications") or []
    if isinstance(pubs, list):
        for i, pub in enumerate(pubs):
            if not isinstance(pub, dict):
                continue
            doi = pub.get("doi")
            if isinstance(doi, str) and doi.strip() and not _DOI_REGEX.match(doi.strip()):
                return f"publications[{i}].doi 格式不合法"
    researchers = state.get("researchers") or []
    if isinstance(researchers, list):
        for i, r in enumerate(researchers):
            if not isinstance(r, dict):
                continue
            orcid = r.get("orcid")
            if isinstance(orcid, str) and orcid.strip() and not _ORCID_REGEX.match(orcid.strip()):
                return f"researchers[{i}].orcid 格式不合法"
    return None


def _json_body() -> tuple[dict, None] | tuple[None, Any]:
    """Parse the JSON request body and return (data, None) or (None, error_response).

    We distinguish three failure modes so callers (and clients) get the right
    HTTP status:

      * Not application/json → 415
      * Body is too large (MAX_CONTENT_LENGTH exceeded) → 413
      * Body parses as JSON but isn't an object → 400
      * JSON parse error → 400
    """
    if not request.is_json:
        return None, _bad("请求必须是 application/json", 415)
    # Werkzeug raises RequestEntityTooLarge when the raw body exceeds
    # MAX_CONTENT_LENGTH (our MAX_JSON_BODY). Re-raise as our 413 with a
    # clearer message; don't swallow it as "JSON parse error".
    from werkzeug.exceptions import RequestEntityTooLarge
    try:
        data = request.get_json(silent=False)
    except RequestEntityTooLarge as e:
        return None, _bad(
            f"请求体过大（上限 {MAX_JSON_BODY} 字节）", 413,
        )
    except Exception:
        return None, _bad("请求体不是合法的 JSON", 400)
    if not isinstance(data, dict):
        return None, _bad("请求体必须是 JSON 对象", 400)
    return data, None


def _resolve_user(uid: int) -> bool:
    """Return True iff a user with this id currently exists in the DB.

    Cached at call-site via the request's db_conn context.
    """
    with db_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE id = ?", (uid,)
        ).fetchone()
    return row is not None


# Maximum nesting depth we accept in state. Beyond this Python's json.dumps
# can hit RecursionError (default limit ~1000) and parsing 5000-level nested
# payloads is a DOS vector anyway. 32 is generous for any real document.
MAX_STATE_DEPTH = 32


def _set_session_cookie(resp, user_id: int) -> None:
    token = make_session_cookie(user_id)
    # Secure flag:
    #   - auto-on when the request itself is HTTPS (request.is_secure), and
    #   - also auto-on when SESSION_COOKIE_SECURE=1 is set (lets operators
    #     force-secure even behind a TLS-terminating proxy that Flask can't
    #     see as HTTPS).
    # Otherwise (dev over plain HTTP) stays False so localhost works.
    force_secure = os.environ.get("SESSION_COOKIE_SECURE", "").strip() == "1"
    secure = bool(getattr(request, "is_secure", False)) or force_secure
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="Lax",
        secure=secure,
        path="/",
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

app = create_app()


def main() -> None:
    # The dev server is fine for local use; for real deployments use a
    # production WSGI server (gunicorn / waitress). We intentionally do NOT
    # run with debug=True: that exposes the Werkzeug debugger and would let
    # anyone execute arbitrary Python.
    print(f"🚀 MeteoHub Server Starting...")
    print(f"   Python: {sys.version.split()[0]}")
    print(f"   Host:   {HOST}")
    print(f"   Port:   {PORT}")
    print(f"   DB:     {DB_PATH}")
    print()
    app.run(host=HOST, port=PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
