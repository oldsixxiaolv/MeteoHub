"""A second Flask factory instance must not redirect the first one's database."""


def test_two_live_apps_keep_separate_databases(tmp_path, empty_state):
    import server

    original_default = server.DB_PATH
    first = server.create_app(str(tmp_path / "first.db"))
    a = first.test_client()
    assert a.post("/api/auth/register", json={"username": "alice", "password": "secret123"}).status_code == 201
    second = server.create_app(str(tmp_path / "second.db"))
    b = second.test_client()
    assert b.post("/api/auth/register", json={"username": "bob", "password": "secret123"}).status_code == 201

    assert a.get("/api/auth/me").json["user"]["username"] == "alice"
    assert b.get("/api/auth/me").json["user"]["username"] == "bob"
    state_a = dict(empty_state, profile={"realName": "Alice private"})
    assert a.put("/api/state", json={"state": state_a, "revision": 0}).status_code == 200
    assert b.get("/api/state").json["state"]["profile"] == {}
    assert a.get("/api/state").json["state"]["profile"] == state_a["profile"]
    assert server.DB_PATH == original_default

    restarted = server.create_app(str(tmp_path / "first.db")).test_client()
    assert restarted.post("/api/auth/login", json={"username": "alice", "password": "secret123"}).status_code == 200
    assert restarted.get("/api/state").json["state"]["profile"] == state_a["profile"]
