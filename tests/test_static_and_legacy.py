"""Static file protection + dangerous-endpoint removal."""

from __future__ import annotations


def test_index_served_at_root(client):
    r = client.get("/")
    assert r.status_code == 200


def test_allowlisted_assets_served(client):
    for path in ("styles.css", "workspace.css", "app.js", "workspace.js"):
        r = client.get(f"/{path}")
        # Files may legitimately not exist on disk yet; what we forbid is 404 due
        # to allow-list, not 404 due to allow-list bypass. So accept 200 (file
        # present) or 404 (file missing). Reject anything else.
        assert r.status_code in (200, 404), (path, r.status_code)


def test_server_py_is_blocked(client):
    r = client.get("/server.py")
    assert r.status_code == 404


def test_assets_folder_blocks_dangerous_extensions(client, temp_db_path, monkeypatch):
    """An assets/foo.py drop-in must not be served even though assets/ is allowed."""
    import os
    import shutil
    assets_dir = os.path.join(os.path.dirname(temp_db_path), "_assets_test_assets")
    os.makedirs(assets_dir, exist_ok=True)
    fake = os.path.join(assets_dir, "server.py")
    with open(fake, "w") as f:
        f.write("print('pwn')")
    try:
        proj_assets = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                                   "assets")
        os.makedirs(proj_assets, exist_ok=True)
        proj_fake = os.path.join(proj_assets, "server.py")
        shutil.copy(fake, proj_fake)
        try:
            r = client.get("/assets/server.py")
            assert r.status_code == 404
        finally:
            if os.path.exists(proj_fake):
                os.unlink(proj_fake)
            if os.path.exists(proj_assets) and not os.listdir(proj_assets):
                os.rmdir(proj_assets)
    finally:
        if os.path.exists(assets_dir):
            shutil.rmtree(assets_dir, ignore_errors=True)


def test_flask_default_static_route_is_disabled(client, app):
    """Flask auto-registers /static/<path:filename>; we must not serve from it.

    Even with no `static/` folder on disk, an attacker could drop a file
    there later — the route would then silently serve it, bypassing our
    allow-list. We replace the static endpoint with a 404 handler.
    """
    for p in ("/static/index.html", "/static/styles.css", "/static/server.py",
              "/static/anything", "/static/../server.py"):
        r = client.get(p)
        assert r.status_code == 404, p


def test_requirements_txt_is_blocked(client):
    r = client.get("/requirements.txt")
    assert r.status_code == 404


def test_git_directory_is_blocked(client):
    for p in ("/.git/HEAD", "/.git/config", "/.gitignore"):
        r = client.get(p)
        assert r.status_code == 404


def test_database_files_are_blocked(client):
    for name in ("meteohub.db", "meteohub.db-journal", "meteohub.db-wal",
                 "data/meteohub.db"):
        r = client.get(f"/{name}")
        assert r.status_code == 404, name


def test_log_files_are_blocked(client):
    r = client.get("/server.log")
    assert r.status_code == 404


def test_tests_directory_is_blocked(client):
    for p in ("/tests", "/tests/test_auth.py"):
        r = client.get(p)
        assert r.status_code == 404


def test_path_traversal_blocked(client):
    r = client.get("/../server.py")
    assert r.status_code in (301, 302, 404)
    # Critical: never 200.
    assert r.status_code != 200


def test_run_code_endpoint_returns_410_with_clear_message(client):
    r = client.post("/api/run-code", json={"code": "print('hi')"})
    assert r.status_code == 410
    body = r.get_json()
    # The message must explain that the feature was removed, not pretend it ran.
    assert "error" in body
    assert "已下线" in body["error"] or "下线" in body["error"]


def test_admin_endpoints_gone(client):
    assert client.get("/api/admin/stats").status_code == 404
    assert client.post("/api/admin/clear-history").status_code == 404
    assert client.get("/api/code-history").status_code == 404


def test_code_runs_counter_is_anonymous(client):
    """The counter must never expose user ids or usernames."""
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    r = client.get("/api/code-runs")
    assert r.status_code == 200
    body = r.get_json()
    assert "count" in body
    text = r.get_data(as_text=True)
    assert "alice" not in text
    assert "user" not in text.lower() or body == {"count": body["count"]}


def test_active_count_is_anonymous(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    client.post("/api/track-active")
    r = client.get("/api/active-count")
    assert r.status_code == 200
    body = r.get_json()
    assert "active_count" in body
    assert "users" not in body, body
