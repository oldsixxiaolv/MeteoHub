"""GET/PUT /api/state with version conflict (409) and per-user isolation."""

from __future__ import annotations

import copy


def _alice(client):
    client.post("/api/auth/register",
                json={"username": "alice", "password": "secret123"})
    return client


def _bob(client):
    client.post("/api/auth/register",
                json={"username": "bob", "password": "secret123"})
    return client


def test_get_state_requires_login(client):
    r = client.get("/api/state")
    assert r.status_code == 401


def test_get_state_returns_empty_state_with_rev_0(client, empty_state):
    _alice(client)
    r = client.get("/api/state")
    assert r.status_code == 200
    body = r.get_json()
    assert body["revision"] == 0
    assert body["state"] == empty_state


def test_put_state_round_trip(client, empty_state):
    _alice(client)
    new_state = copy.deepcopy(empty_state)
    new_state["publications"].append({"id": "p1", "title": "Hello, world"})
    r = client.put("/api/state", json={"state": new_state, "revision": 0})
    assert r.status_code == 200
    body = r.get_json()
    assert body["revision"] == 1
    assert body["state"]["publications"][0]["title"] == "Hello, world"

    # GET returns what we just wrote.
    g = client.get("/api/state").get_json()
    assert g["revision"] == 1
    assert g["state"] == new_state


def test_put_state_with_wrong_revision_returns_409(client, empty_state):
    _alice(client)
    r = client.put("/api/state", json={"state": empty_state, "revision": 99})
    assert r.status_code == 409
    body = r.get_json()
    assert "state" in body and "revision" in body
    assert body["revision"] == 0


def test_put_state_409_carries_current_state(client, empty_state):
    """After a 409 the client must be able to recover by reading body.state."""
    _alice(client)
    # Seed a known good state at rev 0.
    seed = copy.deepcopy(empty_state)
    seed["profile"]["name"] = "Alice"
    r = client.put("/api/state", json={"state": seed, "revision": 0})
    assert r.status_code == 200
    assert r.get_json()["revision"] == 1

    # Both clients think rev is 1 and try to write.
    s1 = copy.deepcopy(empty_state); s1["profile"]["name"] = "From Alice 1"
    s2 = copy.deepcopy(empty_state); s2["profile"]["name"] = "From Bob"
    a = client.put("/api/state", json={"state": s1, "revision": 1})
    assert a.status_code == 200
    b = client.put("/api/state", json={"state": s2, "revision": 1})
    assert b.status_code == 409
    body = b.get_json()
    assert body["state"]["profile"]["name"] == "From Alice 1"
    assert body["revision"] == 2


def test_put_state_validation_rejects_missing_keys(client, empty_state):
    _alice(client)
    bad = {"publications": []}  # missing the other top-level keys
    r = client.put("/api/state", json={"state": bad, "revision": 0})
    assert r.status_code == 400


def test_put_state_validation_rejects_wrong_types(client):
    _alice(client)
    bad = {
        "publications": "not-a-list",
        "questions": [], "researchers": [], "following": [],
        "bookmarks": [], "profile": {}, "pages": [], "projects": [],
    }
    r = client.put("/api/state", json={"state": bad, "revision": 0})
    assert r.status_code == 400


def test_put_state_validation_rejects_non_dict_profile(client):
    _alice(client)
    bad = {
        "publications": [], "questions": [], "researchers": [], "following": [],
        "bookmarks": [], "profile": [], "pages": [], "projects": [],
    }
    r = client.put("/api/state", json={"state": bad, "revision": 0})
    assert r.status_code == 400


def test_put_state_rejects_non_integer_revision(client, empty_state):
    _alice(client)
    r = client.put("/api/state",
                   json={"state": empty_state, "revision": "1"})
    assert r.status_code == 400
    r = client.put("/api/state",
                   json={"state": empty_state, "revision": -1})
    assert r.status_code == 400


def test_per_user_isolation(client, empty_state):
    """Alice's writes must never leak into Bob's GET."""
    _alice(client)
    s = copy.deepcopy(empty_state)
    s["publications"].append({"id": "a1", "title": "Alice's paper"})
    r = client.put("/api/state", json={"state": s, "revision": 0})
    assert r.status_code == 200

    # Switch to Bob in a separate client (separate cookie jar).
    bob_client = client.application.test_client()
    bob_client.post("/api/auth/register",
                    json={"username": "bob", "password": "secret123"})
    bob_state = bob_client.get("/api/state").get_json()
    assert bob_state["revision"] == 0
    assert bob_state["state"]["publications"] == []

    # Alice still sees her own data.
    alice_state = client.get("/api/state").get_json()
    assert alice_state["state"]["publications"][0]["title"] == "Alice's paper"


def test_state_survives_simulated_restart(app, client, empty_state):
    """Persisted state must be readable after we re-open the DB."""
    import sqlite3
    from server import create_app, make_session_cookie, _get_secret_key

    _alice(client)
    s = copy.deepcopy(empty_state)
    s["publications"].append({"id": "z", "title": "persisted"})
    r = client.put("/api/state", json={"state": s, "revision": 0})
    assert r.status_code == 200
    db_path = app.config["METEOHUB_DB"]

    # Pull alice's user_id from the DB, then re-open the app → fresh client.
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        uid = conn.execute(
            "SELECT id FROM users WHERE username = ?", ("alice",)
        ).fetchone()["id"]

    fresh = create_app(db_path=db_path).test_client()
    fresh.set_cookie("meteohub_session", make_session_cookie(uid))

    g = fresh.get("/api/state").get_json()
    assert g["revision"] == 1
    assert g["state"]["publications"][0]["title"] == "persisted"
