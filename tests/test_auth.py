"""Auth endpoints: register, login, logout, me."""

from __future__ import annotations


def _register(client, username: str, password: str):
    return client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )


def test_register_returns_user_and_session_cookie(client):
    r = _register(client, "alice", "secret123")
    assert r.status_code == 201, r.get_data(as_text=True)
    body = r.get_json()
    assert body == {"user": {"id": 1, "username": "alice"}}
    assert "meteohub_session" in r.headers.get("Set-Cookie", "")
    # HttpOnly + SameSite=Lax
    set_cookie = r.headers["Set-Cookie"]
    assert "HttpOnly" in set_cookie
    assert "SameSite=Lax" in set_cookie


def test_register_rejects_duplicate_username(client):
    assert _register(client, "alice", "secret123").status_code == 201
    r = _register(client, "ALICE", "secret456")  # case-insensitive uniqueness
    assert r.status_code == 409
    assert "error" in r.get_json()


def test_register_rejects_short_username_and_password(client):
    assert _register(client, "ab", "secret123").status_code == 400
    assert _register(client, "alice", "123").status_code == 400


def test_register_rejects_bad_username_charset(client):
    r = _register(client, "alice@home", "secret123")
    assert r.status_code == 400


def test_register_rejects_non_string_fields(client):
    r = client.post("/api/auth/register", json={"username": 123, "password": "secret123"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"username": "alice", "password": ["x"]})
    assert r.status_code == 400


def test_register_rejects_missing_fields(client):
    r = client.post("/api/auth/register", json={"username": "alice"})
    assert r.status_code == 400
    r = client.post("/api/auth/register", json={"password": "secret123"})
    assert r.status_code == 400


def test_register_rejects_oversized_username(client):
    r = _register(client, "x" * 65, "secret123")
    assert r.status_code == 400


def test_register_rejects_non_json_body(client):
    r = client.post("/api/auth/register", data="not json",
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 400


def test_login_success(client):
    _register(client, "alice", "secret123")
    client2 = client.application.test_client()
    r = client2.post("/api/auth/login",
                     json={"username": "alice", "password": "secret123"})
    assert r.status_code == 200
    assert r.get_json() == {"user": {"id": 1, "username": "alice"}}


def test_login_wrong_password(client):
    _register(client, "alice", "secret123")
    r = client.post("/api/auth/login",
                    json={"username": "alice", "password": "WRONG"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/api/auth/login",
                    json={"username": "ghost", "password": "secret123"})
    assert r.status_code == 401


def test_login_rejects_non_string_fields(client):
    r = client.post("/api/auth/login", json={"username": None, "password": "x"})
    assert r.status_code == 400


def test_me_unauthenticated(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.get_json() == {"user": None}


def test_me_authenticated(client):
    _register(client, "alice", "secret123")
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    body = r.get_json()
    assert body["user"]["username"] == "alice"
    assert isinstance(body["user"]["id"], int)


def test_logout_clears_cookie(client):
    _register(client, "alice", "secret123")
    r = client.post("/api/auth/logout")
    assert r.status_code == 200
    # The Set-Cookie should expire the session cookie.
    set_cookie = r.headers.get("Set-Cookie", "")
    assert "meteohub_session" in set_cookie
    # After logout, /me says user is null.
    me = client.get("/api/auth/me")
    assert me.get_json() == {"user": None}


def test_register_creates_initial_state_row(client):
    _register(client, "alice", "secret123")
    r = client.get("/api/state")
    assert r.status_code == 200
    body = r.get_json()
    assert body["revision"] == 0
    assert body["state"]["publications"] == []
    assert body["state"]["profile"] == {}


def test_tampered_cookie_is_rejected(app):
    """A signed cookie that has been mangled must not authenticate."""
    from server import make_session_cookie
    bad = app.test_client()
    # Mint a properly-signed cookie for a uid that does not exist in the DB.
    bad.set_cookie("meteohub_session", make_session_cookie(99999))
    me = bad.get("/api/auth/me").get_json()
    assert me == {"user": None}
    # And a totally garbage value should also fail.
    bad.set_cookie("meteohub_session", "not-a-real-token")
    me2 = bad.get("/api/auth/me").get_json()
    assert me2 == {"user": None}
