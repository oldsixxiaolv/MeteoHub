"""Hermes backend audit — independent, read-only probes.

Run: python3 qa/backend-audit-probes.py

These probes exercise the contract the leader called out:
  - 多账号隔离
  - 多个 app 实例 DB 隔离
  - SECRET_KEY env 生效 (现状观察, 修复项已知)
  - cookie / 跨源写入
  - 恶意嵌套 state 与大小限制
  - 版本并发
  - 静态资源旁路
  - PID 复用误杀 (脚本级)

All probes are non-destructive: they use isolated temp DBs, never touch the
project's data/meteohub.db or server.pid.

Output: human-readable findings written to stdout. Each finding has a tag
[CRITICAL]/[HIGH]/[MEDIUM]/[LOW] and a reproducible recipe.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Make server.py importable
import server  # noqa: E402


_findings = []


def add(severity, title, recipe, evidence):
    _findings.append({
        "severity": severity,
        "title": title,
        "recipe": recipe,
        "evidence": evidence,
    })


# ---------------------------------------------------------------------------
# Probe harness
# ---------------------------------------------------------------------------

def make_app_pair(db_path):
    """Return (app_a, app_b) — two independent Flask apps on the same SQLite file."""
    a = server.create_app(db_path=db_path)
    b = server.create_app(db_path=db_path)
    return a, b


def make_empty_state():
    return {
        "publications": [], "questions": [], "researchers": [],
        "following": [], "bookmarks": [], "profile": {},
        "pages": [], "projects": [],
    }


def register(c, username="alice", password="secret123"):
    return c.post("/api/auth/register",
                  json={"username": username, "password": password})


# ---------------------------------------------------------------------------
# A. Multi-account isolation
# ---------------------------------------------------------------------------

def probe_account_isolation():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        a, _ = make_app_pair(db)
        ca = a.test_client()
        cb = a.test_client()  # separate cookie jar
        cc = a.test_client()
        register(ca, "alice", "secret123")
        register(cb, "bob", "secret123")
        register(cc, "carol", "secret123")
        # Alice writes
        s = make_empty_state()
        s["profile"]["name"] = "Alice私人"
        s["pages"].append({"id": "a-page", "title": "Alice的笔记", "blocks": []})
        r = ca.put("/api/state", json={"state": s, "revision": 0})
        assert r.status_code == 200, r.get_data(as_text=True)
        # Bob writes
        s2 = make_empty_state()
        s2["profile"]["name"] = "Bob私人"
        s2["pages"].append({"id": "b-page", "title": "Bob的笔记", "blocks": []})
        r = cb.put("/api/state", json={"state": s2, "revision": 0})
        assert r.status_code == 200
        # Each reads own only
        alice = ca.get("/api/state").get_json()
        bob = cb.get("/api/state").get_json()
        carol = cc.get("/api/state").get_json()
        assert alice["state"]["profile"]["name"] == "Alice私人"
        assert bob["state"]["profile"]["name"] == "Bob私人"
        # Carol has never written, so her profile is still the empty {}
        assert carol["state"]["profile"] == {}, carol
        assert all(p["title"] != "Bob的笔记" for p in alice["state"]["pages"])
        assert all(p["title"] != "Alice的笔记" for p in bob["state"]["pages"])
        # Cross check via /me
        assert ca.get("/api/auth/me").get_json()["user"]["username"] == "alice"
        assert cb.get("/api/auth/me").get_json()["user"]["username"] == "bob"
        print("[OK] A. account isolation holds for 3 users")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# B. Multi-app-instance DB isolation + OCC
# ---------------------------------------------------------------------------

def probe_concurrent_occ():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        a, b = make_app_pair(db)
        ca = a.test_client()
        register(ca, "alice", "secret123")
        # Seed
        s0 = make_empty_state()
        s0["profile"]["seed"] = "v0"
        r = ca.put("/api/state", json={"state": s0, "revision": 0})
        assert r.status_code == 200
        rev = r.get_json()["revision"]
        # Two writers (different processes of the same DB) attempt the same rev
        cb = b.test_client()
        cb.set_cookie("meteohub_session", server.make_session_cookie(
            _get_alice_uid(db)))
        s1 = make_empty_state(); s1["profile"]["seed"] = "from-A"
        s2 = make_empty_state(); s2["profile"]["seed"] = "from-B"
        ra = ca.put("/api/state", json={"state": s1, "revision": rev})
        rb = cb.put("/api/state", json={"state": s2, "revision": rev})
        codes = sorted([ra.status_code, rb.status_code])
        assert codes == [200, 409], (codes, ra.get_data(as_text=True), rb.get_data(as_text=True))
        # Final stored value is the winner's; second gets 409 with the new rev
        winner = ra if ra.status_code == 200 else rb
        loser = rb if winner is ra else ra
        body = loser.get_json()
        assert body["revision"] == rev + 1
        assert "state" in body
        print("[OK] B. concurrent OCC: exactly one writer wins, other gets 409 with new rev")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


def _get_alice_uid(db):
    import sqlite3
    with sqlite3.connect(db) as conn:
        return conn.execute("SELECT id FROM users WHERE username='alice'").fetchone()[0]


# ---------------------------------------------------------------------------
# C. SECRET_KEY env behavior (现状观察 — 已知修复项)
# ---------------------------------------------------------------------------

def probe_secret_key_env():
    # Verify whether SECRET_KEY env var is now respected by the running code.
    # The current server.py:134-136 explicitly checks env first.
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        os.environ["SECRET_KEY"] = "test-env-secret-do-not-use-in-prod"
        # Reload server module to ensure _get_secret_key uses current source.
        import importlib
        importlib.reload(server)
        try:
            key = server._get_secret_key()
        except Exception as e:
            key = b"<err: " + str(e).encode() + b">"
        env_val = os.environ["SECRET_KEY"].encode("utf-8")
        if key == env_val:
            print("[OK] C. SECRET_KEY env var IS respected by _get_secret_key()")
        else:
            add(
                "MEDIUM",
                "SECRET_KEY env var is ignored by _get_secret_key()",
                (
                    "Set SECRET_KEY=mysecret and reload server; "
                    "call _get_secret_key() — does it return env value or file content?"
                ),
                f"got key: {key!r}; expected env value: {env_val!r}",
            )
            print(f"[FINDING] C. env ignored; got key={key!r}")
        del os.environ["SECRET_KEY"]
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# D. Cross-origin cookie / CSRF behavior
# ---------------------------------------------------------------------------

def probe_cross_origin():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        register(c, "alice", "secret123")
        # Simulate cross-origin POST. Flask test_client lets us set headers.
        # Werkzeug parses Origin header.
        s = make_empty_state()
        s["profile"]["attacker"] = "yes"
        # Cross-origin POST with text/plain (a classic JSON-CSRF bypass)
        r = c.post(
            "/api/state",
            data=json.dumps({"state": s, "revision": 0}),
            headers={
                "Content-Type": "text/plain",
                "Origin": "https://evil.example",
            },
        )
        # Browser would send the cookie (SameSite=Lax allows form POST? No — Lax
        # blocks cross-origin POSTs entirely. But the test_client always sends
        # cookies; the protection must be elsewhere. There IS no CSRF token.)
        # So the only protection is SameSite=Lax. Test client doesn't simulate
        # that. We document this as a finding.
        print(f"[INFO] D. cross-origin POST without CSRF token: {r.status_code}")
        add(
            "MEDIUM",
            "No CSRF token; protection relies solely on SameSite=Lax cookie attribute",
            (
                "Open a logged-in tab to http://127.0.0.1:8080. From another origin "
                "(e.g. file:// or http://localhost:9999) submit a form/JS POST to "
                "http://127.0.0.1:8080/api/state. Without SameSite=Strict, "
                "top-level cross-origin POSTs still include the cookie in older "
                "browsers, and a determined attacker can use a same-site subdomain "
                "bypass. Mitigation: also require a CSRF token in body for state writes."
            ),
            (
                "server.py:_set_session_cookie sets SameSite='Lax' but no token. "
                "State-mutating endpoints (PUT /api/state, POST /api/auth/logout) "
                "accept any same-site request as long as the cookie is present. "
                "Top-level GET navigations include Lax cookies but cannot mutate state."
            ),
        )
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# E. Malicious nested state + size limits
# ---------------------------------------------------------------------------

def probe_state_limits():
    """Probe malicious nested state + size limits (BOTH test client and real HTTP).

    Current code (post-fix):
      * MAX_STATE_DEPTH = 32 — _check_depth() rejects deep nesting.
      * MAX_STATE_BYTES = 2 MiB — manual check on serialized state UTF-8 bytes.
      * MAX_JSON_BODY = 2 MiB + 16 KiB — Flask MAX_CONTENT_LENGTH.
      * _json_body() catches RequestEntityTooLarge → 413.
    """
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    # ---- Phase 1: test client ----
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        register(c, "alice", "secret123")
        # 200KB body — should be ACCEPTED now (limit raised to 2 MiB)
        big_payload = {"state": make_empty_state(), "revision": 0,
                       "padding": "x" * (200 * 1024)}
        body = json.dumps(big_payload).encode()
        r = c.put("/api/state", data=body, headers={"Content-Type": "application/json"})
        status_e1 = r.status_code
        # 5000-deep nesting — should be REJECTED now (MAX_STATE_DEPTH=32)
        deep = {"k": "v"}
        for _ in range(5000):
            deep = {"k": deep}
        s = make_empty_state()
        s["profile"]["deep"] = deep
        body2 = json.dumps({"state": s, "revision": 0})
        r2 = c.put("/api/state", data=body2, headers={"Content-Type": "application/json"})
        # unicode bomb
        bomb = make_empty_state()
        bomb["profile"]["name"] = "🐱" * 50000
        body3 = json.dumps({"state": bomb, "revision": 0})
        r3 = c.put("/api/state", data=body3, headers={"Content-Type": "application/json"})
        # __proto__ weird
        weird = make_empty_state()
        weird["pages"].append({"__proto__": "x"})
        body4 = json.dumps({"state": weird, "revision": 0})
        r4 = c.put("/api/state", data=body4, headers={"Content-Type": "application/json"})
        print(f"[INFO] E. test-client: 200KB body -> {status_e1}; 5000-deep nest -> {r2.status_code}; unicode bomb -> {r3.status_code}; __proto__ -> {r4.status_code}")
        # New expectations: 200KB → 200 (under 2 MiB limit); 5000-deep → 400 (depth limit)
        findings_found = False
        if status_e1 not in (200, 201):
            findings_found = True
            add(
                "HIGH",
                "200KB body is rejected but should be accepted (post-fix limit is 2 MiB)",
                f"PUT 200KB returned {status_e1}; body: {r.get_data(as_text=True)[:120]}",
                f"server.MAX_STATE_BYTES={server.MAX_STATE_BYTES}",
            )
        if r2.status_code == 200:
            findings_found = True
            add(
                "MEDIUM",
                "5000-deep nesting is still accepted (MAX_STATE_DEPTH not enforced?)",
                f"PUT depth-5000 returned {r2.status_code}; body: {r2.get_data(as_text=True)[:120]}",
            )
        if not findings_found:
            print("[OK] E. size and depth limits behave as documented")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass

    # ---- Phase 2: real HTTP ----
    import threading
    from werkzeug.serving import make_server
    fd2, db2 = tempfile.mkstemp(suffix=".db"); os.close(fd2)
    try:
        app = server.create_app(db_path=db2)
        srv = make_server("127.0.0.1", 0, app, threaded=True)
        port = srv.server_port
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        time.sleep(0.4)
        # register & capture cookie
        from http.client import HTTPConnection
        conn = HTTPConnection("127.0.0.1", port)
        conn.request("POST", "/api/auth/register",
                     body=json.dumps({"username": "alice2", "password": "secret123"}).encode(),
                     headers={"Content-Type": "application/json"})
        resp = conn.getresponse(); resp.read()
        cookie_match = re.search(r"(meteohub_session=[^;]+)", resp.headers.get("Set-Cookie", ""))
        cookie = cookie_match.group(1) if cookie_match else ""
        # Real HTTP — push at, above, and well above the 2 MiB+16 KiB envelope.
        results = []
        for kb in [100, 1024, 2048, 3072]:
            padding = "x" * (kb * 1024 - 200)
            big = {"state": make_empty_state(), "revision": 0, "padding": padding}
            body = json.dumps(big).encode()
            conn = HTTPConnection("127.0.0.1", port)
            conn.request("PUT", "/api/state", body=body,
                         headers={"Content-Type": "application/json", "Cookie": cookie})
            r = conn.getresponse()
            body_resp = r.read().decode(errors="replace")[:120]
            results.append((kb, len(body), r.status, body_resp))
        srv.shutdown()
        ok_lines = "\n".join(f"  {kb}KB wire({wire}B): status={st} body={b!r}"
                             for (kb, wire, st, b) in results)
        print(f"[INFO] E-real. real-HTTP probe results:\n{ok_lines}")
        # Expected: <=2048KB OK, >2048KB+16KB envelope → 413
        bad = [(kb, st, b) for (kb, wire, st, b) in results
               if (kb <= 2048 and st != 200 and st != 409) or (kb > 2048 and st != 413)]
        if bad:
            add(
                "HIGH",
                "Real-HTTP size limit is misaligned with the 2 MiB cap",
                f"Unexpected statuses: {bad}",
            )
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db2 + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# F. Static resource bypass
# ---------------------------------------------------------------------------

def probe_static_bypass():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        probes = [
            "/server.py", "/requirements.txt", "/HOW_TO_RUN.md",
            "/README.md", "/LICENSE",
            "/data", "/data/", "/data/meteohub.db",
            "/data/secret.key",
            "/.git/HEAD", "/.git/config", "/.gitignore",
            "/tests", "/tests/test_auth.py", "/tests/conftest.py",
            "/server.log", "/server.pid",
            "/.env",
            "/workspace.js.bak", "/app.js.map", "/foo.html",
            "/index.html/", "/index.html/../server.py",
            "/assets/../server.py",
            "/favicon.ico",  # in allowlist but file may not exist
            "/assets/none.png",
            "/static/x", "/img/x",  # prefixes allowed even if no such dir
        ]
        leaks = []
        for path in probes:
            r = c.get(path)
            if r.status_code == 200:
                # any 200 is a leak
                leaks.append((path, r.status_code, r.get_data(as_text=True)[:60]))
        if leaks:
            add("CRITICAL", "Static allow-list leaks file",
                "GET each of the paths above", str(leaks))
        else:
            print("[OK] F. all probed static paths return 404 (or are in allow-list)")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# G. State-get auto-init race
# ---------------------------------------------------------------------------

def probe_autoinit_race():
    # Already fixed in current code via INSERT OR IGNORE. Probe just confirms.
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        register(c, "alice", "secret123")
        # Delete the state row to simulate legacy user
        import sqlite3
        with sqlite3.connect(db) as conn:
            conn.execute("DELETE FROM state")
            conn.commit()
        # Now issue many concurrent GETs
        results = []
        def hit():
            r = c.get("/api/state")
            results.append(r.status_code)
        threads = [threading.Thread(target=hit) for _ in range(20)]
        for t in threads: t.start()
        for t in threads: t.join()
        from collections import Counter
        ctr = Counter(results)
        if 500 in ctr:
            add(
                "MEDIUM",
                "state_get auto-init has TOCTOU race; concurrent first-GETs return 500",
                (
                    "Register a user; DELETE FROM state WHERE user_id=...; "
                    "issue 20 concurrent GET /api/state; observe 500s."
                ),
                f"Status codes observed: {dict(ctr)}",
            )
            print(f"[FINDING] G. auto-init race -> {dict(ctr)}")
        else:
            print(f"[OK] G. auto-init race not reproducible: {dict(ctr)}")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# H. Cookie Secure flag + security headers
# ---------------------------------------------------------------------------

def probe_cookie_headers():
    fd, db = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        r = register(c, "alice", "secret123")
        set_cookie = r.headers.get("Set-Cookie", "")
        # Headers on the index response
        r2 = c.get("/")
        security_headers = {
            "X-Content-Type-Options": r2.headers.get("X-Content-Type-Options"),
            "X-Frame-Options": r2.headers.get("X-Frame-Options"),
            "Content-Security-Policy": r2.headers.get("Content-Security-Policy"),
            "Strict-Transport-Security": r2.headers.get("Strict-Transport-Security"),
        }
        print(f"[INFO] H. Set-Cookie={set_cookie[:100]}")
        print(f"[INFO] H. security headers={security_headers}")
        # Secure flag warning — still relevant when serving 0.0.0.0 over HTTP.
        if "Secure" not in set_cookie and "127.0.0.1" not in server.HOST:
            add(
                "MEDIUM",
                "Session cookie has Secure=False even when bound to 0.0.0.0",
                (
                    "Set HOST=0.0.0.0, register a user, inspect Set-Cookie. "
                    "Secure flag is missing; cookie will travel in cleartext if served "
                    "over plain HTTP on a non-local network."
                ),
                f"Set-Cookie: {set_cookie}",
            )
        # Now check the security headers that the leader assigned to fix.
        missing = [k for k, v in security_headers.items()
                   if k != "Strict-Transport-Security" and not v]
        # HSTS is intentionally omitted over HTTP — only meaningful with HTTPS.
        if missing:
            add(
                "LOW",
                "Static responses still lack some security headers",
                f"missing: {missing}; seen: {security_headers}",
            )
        else:
            print(f"[OK] H. security headers present: {list(security_headers.keys())}")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


# ---------------------------------------------------------------------------
# I. PID reuse mishap (script-level)
# ---------------------------------------------------------------------------

def probe_pid_reuse(tmpdir):
    """The leader listed PID reuse mishap as a concern. The current stop.sh
    now verifies cmdline. We just confirm by reading stop.sh source."""
    stop = ROOT / "stop.sh"
    text = stop.read_text() if stop.exists() else ""
    if 'cmdline' in text and 'RESOLVED' in text and 'IS_OURS' in text:
        print("[OK] I. stop.sh now verifies cmdline belongs to this project's server.py")
    else:
        add(
            "MEDIUM",
            "stop.sh does not verify PID cmdline belongs to server.py",
            (
                "Read stop.sh; check that it resolves /proc/<pid>/cmdline or `ps -p $PID -o command=` "
                "and confirms the resolved server.py matches this project's path."
            ),
            f"stop.sh: {text[:200]}...",
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# J. Stale cookie for deleted user → /api/state returns 500
# ---------------------------------------------------------------------------

def probe_deleted_user_stale_cookie():
    """After admin deletes a user, their cookie is still valid for 14 days.
    /api/state GET/PUT must NOT 500 — should 401 (user unknown)."""
    fd, db = tempfile.mkstemp(suffix=".db"); os.close(fd)
    try:
        app = server.create_app(db_path=db)
        c = app.test_client()
        c.post("/api/auth/register", json={"username": "alice", "password": "secret123"})
        # Delete user directly
        import sqlite3
        with sqlite3.connect(db) as conn:
            n = conn.execute("DELETE FROM users").rowcount
        # Mint a fresh cookie for uid=99999 (does not exist)
        c2 = app.test_client()
        c2.set_cookie("meteohub_session", server.make_session_cookie(99999))
        r_get = c2.get("/api/state")
        r_put = c2.put("/api/state",
                       data=json.dumps({"state": make_empty_state(), "revision": 0}).encode(),
                       headers={"Content-Type": "application/json"})
        print(f"[INFO] J. deleted-user stale cookie: GET /api/state -> {r_get.status_code}, PUT /api/state -> {r_put.status_code}")
        if r_get.status_code == 500 or r_put.status_code == 500:
            add(
                "HIGH",
                "Stale cookie for deleted user → /api/state returns 500 instead of 401",
                (
                    "Register a user; DELETE FROM users; mint a fresh signed cookie "
                    "for that user_id; GET /api/state and PUT /api/state."
                ),
                (
                    f"GET status: {r_get.status_code}, body: {r_get.get_data(as_text=True)[:120]}\n"
                    f"PUT status: {r_put.status_code}, body: {r_put.get_data(as_text=True)[:120]}"
                ),
            )
        else:
            print(f"[OK] J. deleted-user stale cookie: returns 401 as expected")
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = db + ext
            if os.path.exists(p):
                try: os.unlink(p)
                except OSError: pass


def probe_cross_instance_db_isolation():
    """Two create_app(db_path=...) calls with DIFFERENT db paths.

    The leader suspected that DB_PATH being a module global serializes
    all apps to the same DB. Test it.
    """
    fd_a, db_a = tempfile.mkstemp(suffix=".db"); os.close(fd_a)
    fd_b, db_b = tempfile.mkstemp(suffix=".db"); os.close(fd_b)
    try:
        app_a = server.create_app(db_path=db_a)
        app_b = server.create_app(db_path=db_b)
        # app_a registers alice
        ca = app_a.test_client()
        r = ca.post("/api/auth/register", json={"username": "alice", "password": "secret123"})
        # Inspect both DB files
        import sqlite3
        with sqlite3.connect(db_a) as conn:
            rows_a = conn.execute("SELECT id, username FROM users").fetchall()
        with sqlite3.connect(db_b) as conn:
            rows_b = conn.execute("SELECT id, username FROM users").fetchall()
        # Expected: alice in db_a (app_a's configured path), db_b empty.
        # Observed: db_a empty, alice in db_b. Cross-contamination.
        if rows_a == [] and rows_b:
            add(
                "HIGH",
                "create_app(db_path=...) cross-instance DB isolation broken: all apps write to the last-set DB_PATH module global",
                (
                    "Call create_app(db_path=A); create_app(db_path=B); "
                    "register a user in app A. Then read both DB files: "
                    "alice appears in B (NOT A). The second create_app() "
                    "overwrites the module-level DB_PATH, so app_a's db_conn() "
                    "calls go to B's file."
                ),
                (
                    f"db_a ({db_a}) users: {rows_a} (expected: [(1,'alice')])\n"
                    f"db_b ({db_b}) users: {rows_b} (expected: [])\n"
                    f"app_a.config['METEOHUB_DB'] = {app_a.config.get('METEOHUB_DB')}\n"
                    f"app_b.config['METEOHUB_DB'] = {app_b.config.get('METEOHUB_DB')}\n"
                    f"module DB_PATH = {server.DB_PATH}\n"
                    "Server.py:db_conn() reads module DB_PATH at call time, not "
                    "app.config['METEOHUB_DB'], so all apps converge to the same DB."
                ),
            )
            print(f"[FINDING] DB cross-contamination: db_a={rows_a}, db_b={rows_b}")
        else:
            print(f"[OK] K. cross-instance DB isolation: db_a={rows_a}, db_b={rows_b}")
    finally:
        for p in [db_a, db_b]:
            for ext in ("", "-journal", "-wal", "-shm"):
                full = p + ext
                if os.path.exists(full):
                    try: os.unlink(full)
                    except OSError: pass


def main():
    print("=== Hermes backend audit ===")
    probe_account_isolation()
    probe_concurrent_occ()
    probe_secret_key_env()
    probe_cross_origin()
    probe_state_limits()
    probe_static_bypass()
    probe_autoinit_race()
    probe_cookie_headers()
    probe_deleted_user_stale_cookie()
    probe_cross_instance_db_isolation()
    with tempfile.TemporaryDirectory() as tmpd:
        probe_pid_reuse(Path(tmpd))

    print()
    print(f"=== {_len_finding_text(findings=_findings)} findings ===")
    for f in _findings:
        print()
        print(f"[{f['severity']}] {f['title']}")
        print("  Recipe:   " + f['recipe'])
        print("  Evidence: " + f['evidence'])


def _len_finding_text(findings):
    return len(findings)


if __name__ == "__main__":
    main()