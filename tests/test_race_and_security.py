"""Race conditions, deleted-user handling, depth limits, Origin check.

These tests verify the corrections from the third review:
* H1 — state_get auto-init must not 500 on concurrent first GETs
* H2 — stale cookie for a deleted user must 401, not 500
* H3 — _json_body must surface 413 distinctly (not swallow as 400)
* M3 — state nesting depth is capped (≤ 32)
* L1 — security response headers are present
* Origin — write endpoints reject obviously cross-origin requests
"""

from __future__ import annotations

import copy
import json
import os
import threading
import time
from collections import Counter

import pytest


# ---------------------------------------------------------------------------
# Fixtures specific to this module
# ---------------------------------------------------------------------------


@pytest.fixture
def authed_client(client, empty_state):
    """A client already registered as 'alice' with a session cookie."""
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    return client


# ---------------------------------------------------------------------------
# H1: state_get auto-init race must not 500
# ---------------------------------------------------------------------------


def test_state_get_concurrent_first_gets_no_500(app, temp_db_path, empty_state):
    """When a user has no state row (legacy / migration case), concurrent
    GETs from the same user must all return 200, not 500."""
    client = app.test_client()
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    # Strip the auto-created state row to simulate a legacy user whose row
    # was never inserted.
    import sqlite3
    with sqlite3.connect(temp_db_path) as conn:
        conn.execute("DELETE FROM state")
        conn.commit()

    N = 30
    results: list[int] = []
    lock = threading.Lock()

    def hit():
        r = client.get("/api/state")
        with lock:
            results.append(r.status_code)

    threads = [threading.Thread(target=hit) for _ in range(N)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    codes = Counter(results)
    assert 500 not in codes, codes
    assert codes[200] == N, codes

    # All responses must report rev=0 and an empty state.
    body = client.get("/api/state").get_json()
    assert body["revision"] == 0
    assert body["state"]["publications"] == []


def test_state_put_concurrent_first_puts_no_500(app, temp_db_path, empty_state):
    """First PUT under concurrency must also avoid 500s (INSERT OR IGNORE)."""
    client = app.test_client()
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    import sqlite3
    with sqlite3.connect(temp_db_path) as conn:
        conn.execute("DELETE FROM state")
        conn.commit()

    N = 20
    results: list[int] = []
    lock = threading.Lock()

    def hit():
        s = copy.deepcopy(empty_state)
        s["profile"]["name"] = f"writer-{threading.get_ident()}"
        r = client.put("/api/state",
                       data=json.dumps({"state": s, "revision": 0}),
                       content_type="application/json")
        with lock:
            results.append(r.status_code)

    threads = [threading.Thread(target=hit) for _ in range(N)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    codes = Counter(results)
    assert 500 not in codes, codes
    # Some writes win (200), the rest get 409 (OCC), all with valid responses.
    for code in codes:
        assert code in (200, 409), codes


# ---------------------------------------------------------------------------
# H2: stale cookie for a deleted user must 401
# ---------------------------------------------------------------------------


def test_deleted_user_stale_cookie_get_returns_401(client, temp_db_path):
    """After admin deletes a user, their cookie is still cryptographically
    valid for 14 days. /api/state must 401, not 500."""
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    # Confirm we can read state normally.
    assert client.get("/api/state").status_code == 200
    # Now wipe the user row directly (simulating admin deletion).
    import sqlite3
    with sqlite3.connect(temp_db_path) as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    # The next /api/state request must NOT 500 — must 401.
    r = client.get("/api/state")
    assert r.status_code == 401, r.get_data(as_text=True)
    # /api/auth/me must agree that the user is unknown.
    assert client.get("/api/auth/me").get_json() == {"user": None}


def test_deleted_user_stale_cookie_put_returns_401(client, temp_db_path, empty_state):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    import sqlite3
    with sqlite3.connect(temp_db_path) as conn:
        conn.execute("DELETE FROM users")
        conn.commit()
    r = client.put("/api/state",
                   json={"state": empty_state, "revision": 0})
    assert r.status_code == 401, r.get_data(as_text=True)


def test_freshly_minted_cookie_for_unknown_uid_returns_401(client, app):
    """A signed cookie whose uid is not in the DB must behave as 401."""
    from server import make_session_cookie
    c = app.test_client()
    c.set_cookie("meteohub_session", make_session_cookie(99999))
    assert c.get("/api/state").status_code == 401
    assert c.get("/api/auth/me").get_json() == {"user": None}


# ---------------------------------------------------------------------------
# H3: _json_body must surface 413 distinctly
# ---------------------------------------------------------------------------


def test_oversized_body_returns_413_not_400(app, client):
    """A real-HTTP body exceeding MAX_JSON_BODY must be rejected with 413,
    not silently masked as 'JSON parse error' (400)."""
    import server
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    too_big = "z" * (server.MAX_JSON_BODY + 1024)
    r = client.put(
        "/api/state",
        data=("{}" + too_big).encode("utf-8"),
        content_type="application/json",
    )
    # Werkzeug may return 413 directly, OR _json_body surfaces it as 413.
    assert r.status_code == 413, r.status_code


def test_non_json_content_type_returns_415(client):
    """A POST without application/json Content-Type must 415, not 400."""
    r = client.post("/api/auth/register", data="not json")
    assert r.status_code == 415


# ---------------------------------------------------------------------------
# M3: depth limit
# ---------------------------------------------------------------------------


def test_state_put_rejects_excessive_depth(client, empty_state):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    # Build a 100-level nested dict (well above MAX_STATE_DEPTH = 32).
    deep = {"k": "v"}
    for _ in range(100):
        deep = {"k": deep}
    state = copy.deepcopy(empty_state)
    state["profile"]["deep"] = deep
    r = client.put("/api/state",
                   json={"state": state, "revision": 0})
    assert r.status_code == 400, r.get_data(as_text=True)


def test_state_put_accepts_normal_depth(client, empty_state):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    # 10-level nesting — well within limit.
    deep = {"k": "v"}
    for _ in range(10):
        deep = {"k": deep}
    state = copy.deepcopy(empty_state)
    state["profile"]["deep"] = deep
    r = client.put("/api/state",
                   json={"state": state, "revision": 0})
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Origin check on writes
# ---------------------------------------------------------------------------


def test_cross_origin_write_is_rejected(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    r = client.post(
        "/api/auth/logout",
        headers={"Origin": "https://evil.example.com"},
    )
    assert r.status_code == 403, r.get_data(as_text=True)


def test_same_origin_write_passes(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    r = client.post(
        "/api/auth/logout",
        headers={"Origin": "http://127.0.0.1"},
    )
    assert r.status_code == 200


def test_no_origin_header_passes_for_write(client):
    """Non-browser clients (curl, server-side fetch) don't send Origin —
    we don't break those."""
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    r = client.post("/api/auth/logout")
    assert r.status_code == 200


def test_get_endpoints_ignore_origin(client):
    """GETs are not state-mutating; the Origin guard must not fire."""
    # Register first (we need a session for /api/state to be meaningful).
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    # Now GET with an evil origin should still succeed.
    r = client.get(
        "/api/state",
        headers={"Origin": "https://evil.example.com"},
    )
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# L1: security headers
# ---------------------------------------------------------------------------


def test_security_headers_present(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    r = client.get("/")
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert "Referrer-Policy" in r.headers
    csp = r.headers.get("Content-Security-Policy", "")
    assert "default-src 'self'" in csp
    assert "frame-ancestors 'none'" in csp
