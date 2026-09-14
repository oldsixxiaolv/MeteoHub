"""Capacity / size limits and SECRET_KEY env precedence.

These tests verify the contract corrections from the second review:
* PUT /api/state accepts >64 KiB of UTF-8 Chinese state (no implicit
  ASCII-escape length limit, no MAX_JSON_BODY squeeze below state cap).
* PUT /api/state rejects anything above MAX_STATE_BYTES by actual UTF-8 bytes.
* SECRET_KEY env var takes precedence over the on-disk key file.
"""

from __future__ import annotations

import copy
import json
import os

import pytest


# ---------------------------------------------------------------------------
# Capacity / size limit tests
# ---------------------------------------------------------------------------


def _put_state(client, state, revision):
    return client.put(
        "/api/state",
        data=json.dumps({"state": state, "revision": revision},
                        ensure_ascii=False).encode("utf-8"),
        content_type="application/json",
    )


def _login_alice(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})


def test_put_state_accepts_64kib_chinese_utf8(client, empty_state):
    """Knowledge base ~64 KiB of Chinese text must succeed.

    Under the old ``MAX_JSON_BODY=64 KiB`` limit a 64 KiB Chinese state
    could not even be PUT (the JSON envelope pushed it over the body cap).
    With the new limits, 64 KiB of UTF-8 state goes through comfortably.
    """
    _login_alice(client)
    # Fill the `publications` list with one entry whose abstract is ~64 KiB.
    # Each Chinese char is 3 UTF-8 bytes, so ~22000 chars ≈ 64 KiB.
    long_zh = "气象研究" * 5500   # 22000 chars, ~66000 bytes
    state = copy.deepcopy(empty_state)
    state["publications"].append({"id": "big", "title": "大文献",
                                   "abstract": long_zh})
    body = json.dumps({"state": state, "revision": 0},
                      ensure_ascii=False).encode("utf-8")
    assert 60_000 < len(body) < 100_000, len(body)  # sanity

    r = client.put("/api/state", data=body, content_type="application/json")
    assert r.status_code == 200, r.get_data(as_text=True)
    assert r.get_json()["revision"] == 1

    # Round-trip: read it back and confirm the Chinese text survived intact.
    g = client.get("/api/state").get_json()
    assert g["state"]["publications"][0]["abstract"] == long_zh


def test_put_state_rejects_above_state_cap(client, empty_state):
    """A state payload whose serialized UTF-8 bytes exceed MAX_STATE_BYTES
    must be rejected with 413 — independent of MAX_JSON_BODY."""
    import server
    _login_alice(client)
    # Build a state whose UTF-8 size is comfortably above MAX_STATE_BYTES
    # but still under MAX_JSON_BODY (state + envelope headroom).
    over = "x" * (server.MAX_STATE_BYTES + 1024)
    state = copy.deepcopy(empty_state)
    state["publications"].append({"id": "huge", "abstract": over})
    body = json.dumps({"state": state, "revision": 0},
                      ensure_ascii=False).encode("utf-8")
    assert server.MAX_STATE_BYTES < len(body) <= server.MAX_JSON_BODY
    r = client.put("/api/state", data=body, content_type="application/json")
    assert r.status_code == 413, r.get_data(as_text=True)


def test_put_state_under_state_cap_succeeds(client, empty_state):
    """A state at ~80% of MAX_STATE_BYTES should still be accepted."""
    import server
    _login_alice(client)
    target = int(server.MAX_STATE_BYTES * 0.8)
    big = "y" * target
    state = copy.deepcopy(empty_state)
    state["publications"].append({"id": "big", "abstract": big})
    body = json.dumps({"state": state, "revision": 0},
                      ensure_ascii=False).encode("utf-8")
    assert len(body) < server.MAX_STATE_BYTES
    r = client.put("/api/state", data=body, content_type="application/json")
    assert r.status_code == 200, r.get_data(as_text=True)


def test_put_state_oversized_envelope_is_caught_somewhere(app, client, empty_state):
    """A body larger than MAX_JSON_BODY cannot reach the handler.

    Either Werkzeug rejects it at MAX_CONTENT_LENGTH (413) or the body
    itself fails JSON parsing once the env enforces the limit — but it
    MUST NOT be stored.
    """
    import server
    _login_alice(client)
    too_big = "z" * (server.MAX_JSON_BODY + 1024)
    r = client.put(
        "/api/state",
        data=("{}" + too_big).encode("utf-8"),
        content_type="application/json",
    )
    # Werkzeug may return 413, or the body may pass MAX_CONTENT_LENGTH but
    # then fail validation (e.g. parse error). What we MUST NOT see is 200.
    assert r.status_code in (400, 413), r.status_code
    # And nothing should have been written.
    g = client.get("/api/state").get_json()
    assert g["revision"] == 0
    assert g["state"]["publications"] == []


# ---------------------------------------------------------------------------
# SECRET_KEY env precedence tests
# ---------------------------------------------------------------------------


def test_secret_key_env_takes_precedence(monkeypatch, temp_db_path):
    """SECRET_KEY env must override the on-disk key file."""
    import server

    # Pre-create a secret file with a known value, then set a different
    # SECRET_KEY env — the env must win.
    disk_key = b"on-disk-key-should-not-be-used"
    secret_dir = os.path.dirname(server.SECRET_FILE)
    os.makedirs(secret_dir, exist_ok=True)
    with open(server.SECRET_FILE, "wb") as f:
        f.write(disk_key)

    monkeypatch.setenv("SECRET_KEY", "env-key-must-win")
    try:
        assert server._get_secret_key() == b"env-key-must-win"
        # Also confirm we did NOT overwrite the on-disk key.
        with open(server.SECRET_FILE, "rb") as f:
            assert f.read() == disk_key
    finally:
        if os.path.exists(server.SECRET_FILE):
            os.unlink(server.SECRET_FILE)


def test_secret_key_env_strips_whitespace(monkeypatch):
    import server
    monkeypatch.setenv("SECRET_KEY", "   padded-key   ")
    assert server._get_secret_key() == b"padded-key"


def test_secret_key_falls_back_to_file_when_env_empty(monkeypatch):
    """If SECRET_KEY env is unset or whitespace, fall back to file."""
    import server
    monkeypatch.delenv("SECRET_KEY", raising=False)
    secret_dir = os.path.dirname(server.SECRET_FILE)
    os.makedirs(secret_dir, exist_ok=True)
    with open(server.SECRET_FILE, "wb") as f:
        f.write(b"file-based-key")
    try:
        assert server._get_secret_key() == b"file-based-key"
    finally:
        if os.path.exists(server.SECRET_FILE):
            os.unlink(server.SECRET_FILE)


def test_secret_key_generates_when_neither(monkeypatch):
    """With no env and no file, we mint and persist a random key."""
    import server
    monkeypatch.delenv("SECRET_KEY", raising=False)
    if os.path.exists(server.SECRET_FILE):
        os.unlink(server.SECRET_FILE)
    k1 = server._get_secret_key()
    try:
        assert len(k1) >= 32
        # Second call returns the same persisted key.
        assert server._get_secret_key() == k1
    finally:
        if os.path.exists(server.SECRET_FILE):
            os.unlink(server.SECRET_FILE)
