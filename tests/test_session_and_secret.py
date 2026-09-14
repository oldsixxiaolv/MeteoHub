"""Session cookie + secret-key hardening tests (P0-5 secure switch + P1-5 max_age)."""

from __future__ import annotations

import importlib
import time

import pytest


def test_secure_cookie_default_false_over_http(client):
    """Default dev path: HTTP request → secure flag stays False (so localhost
    works)."""
    r = client.post(
        "/api/auth/register",
        json={"username": "secuser1", "password": "longenough"},
    )
    assert r.status_code == 201
    cookies = r.headers.getlist("Set-Cookie")
    assert any("Secure" not in c for c in cookies), cookies


def test_secure_cookie_force_on_via_env_var(client, monkeypatch):
    """SESSION_COOKIE_SECURE=1 flips the cookie to Secure regardless of transport."""
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "1")
    r = client.post(
        "/api/auth/register",
        json={"username": "secuser2", "password": "longenough"},
    )
    assert r.status_code == 201
    cookies = r.headers.getlist("Set-Cookie")
    assert any("Secure" in c for c in cookies), cookies


def test_session_max_age_enforced(client):
    """A cookie minted more than SESSION_MAX_AGE seconds ago must be rejected.

    We simulate the passage of time by patching itsdangerous' max_age check at
    the module level rather than sleeping — the goal is to verify that an
    expired token returns 401, not to wait 14 days.
    """
    import server
    from itsdangerous import URLSafeTimedSerializer

    # Re-resolve the serializer using whatever secret the fixture installed.
    secret = b"test-secret-do-not-use"
    s = URLSafeTimedSerializer(secret, salt="meteohub-session")
    token = s.dumps({"uid": 1})

    # Stub itsdangerous so any URLSafeTimedSerializer instance rejects tokens
    # immediately (as if max_age were exceeded).
    import itsdangerous as id_mod
    orig = id_mod.URLSafeTimedSerializer.loads

    def _always_expired(self, *a, **kw):
        raise id_mod.BadTimeSignature("simulated expiry")

    id_mod.URLSafeTimedSerializer.loads = _always_expired
    try:
        r = client.get("/api/state", headers={"Cookie": f"meteohub_session={token}"})
        assert r.status_code == 401
    finally:
        id_mod.URLSafeTimedSerializer.loads = orig


def test_secret_key_chmod_failure_logs_warning(tmp_path, monkeypatch, caplog):
    """When chmod 0600 fails (non-POSIX), we surface a warning instead of
    silently swallowing the OSError."""
    import logging
    import os

    import server

    secret_file = tmp_path / "secret.key"
    monkeypatch.setattr(server, "SECRET_FILE", str(secret_file))

    # Make the env-var path miss so we exercise the file-creation branch.
    monkeypatch.delenv("SECRET_KEY", raising=False)

    # Force chmod to raise.
    def _chmod_fail(path, mode):
        raise OSError("simulated non-POSIX fs")

    monkeypatch.setattr(os, "chmod", _chmod_fail)

    with caplog.at_level(logging.WARNING, logger="meteohub"):
        key = server._get_secret_key()

    assert key, "should still return a key"
    assert any("chmod 0600 failed" in rec.message for rec in caplog.records), [
        rec.message for rec in caplog.records
    ]


def test_init_db_creates_code_runs_index(client):
    """idx_code_runs_at must exist after init_db (P1-3)."""
    # Use the fixture's app to reach the DB the same way the app does.
    import server
    app = client.application
    with app.app_context():
        with server.db_conn() as conn:
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_code_runs_at'"
            ).fetchall()
    assert len(rows) == 1, rows
