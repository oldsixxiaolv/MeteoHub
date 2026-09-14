"""Shared fixtures for the MeteoHub Flask test suite."""

from __future__ import annotations

import os
import sys
import tempfile

import pytest

# Make the project root importable when pytest is invoked from anywhere.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)


@pytest.fixture(autouse=True)
def isolated_secret_file(tmp_path, monkeypatch):
    """Secret-key tests must never overwrite this installation's signing key."""
    import server
    monkeypatch.setattr(server, "SECRET_FILE", str(tmp_path / "secret.key"))


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Each test starts with an empty rate-limit bucket so one test's PUTs
    can't trigger 429s in another. The rate-limit logic itself is exercised
    by tests/test_rate_limit.py, which calls _rate_limit_reset() itself
    before probing boundaries."""
    try:
        import server
        server._rate_limit_reset()
    except Exception:
        pass
    yield
    try:
        import server
        server._rate_limit_reset()
    except Exception:
        pass


@pytest.fixture
def temp_db_path():
    """Per-test SQLite path so tests never share state."""
    fd, path = tempfile.mkstemp(prefix="meteohub-test-", suffix=".db")
    os.close(fd)
    try:
        yield path
    finally:
        for ext in ("", "-journal", "-wal", "-shm"):
            p = path + ext
            if os.path.exists(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass


@pytest.fixture
def app(temp_db_path, monkeypatch):
    """Fresh Flask app per test, isolated DB, deterministic secret."""
    import server
    monkeypatch.setattr(server, "_get_secret_key", lambda: b"test-secret-do-not-use")
    return server.create_app(db_path=temp_db_path)


@pytest.fixture
def app_real_secret(temp_db_path, monkeypatch):
    """Same as `app` but lets _get_secret_key() do real env/file resolution.

    Use this when you actually want to verify that SECRET_KEY env precedence
    works — i.e. you want to assert what the helper returns, not bypass it."""
    import server
    return server.create_app(db_path=temp_db_path)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def client_real(app_real_secret):
    return app_real_secret.test_client()


@pytest.fixture
def empty_state():
    """Minimal legal state payload."""
    return {
        "publications": [],
        "questions": [],
        "researchers": [],
        "following": [],
        "bookmarks": [],
        "profile": {},
        "pages": [],
        "projects": [],
    }
