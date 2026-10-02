"""Rate-limit tests for /api/auth/login, /api/auth/register, PUT /api/state.

The limits live in `server._RATE_LIMITS`. Per the design:
  - auth_login:      5 requests / 60s / IP
  - auth_register:   5 requests / 60s / IP
  - state_put:       30 requests / 60s / IP

We don't actually sleep for 60 seconds — instead we verify the 429 response
on the 6th (or 31st) request, the Retry-After header is present, and a
different IP key doesn't share the bucket.
"""

from __future__ import annotations


def test_auth_login_returns_429_after_5_attempts(client):
    """6th login attempt from same IP must return 429 with Retry-After."""
    for i in range(5):
        r = client.post(
            "/api/auth/login",
            json={"username": "nope", "password": "wrong"},
        )
        # We don't care about success — the rate limit must not have tripped
        # yet on attempts 1-5.
        assert r.status_code != 429, f"hit 429 on attempt {i + 1}"
    r = client.post(
        "/api/auth/login",
        json={"username": "nope", "password": "wrong"},
    )
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    assert int(r.headers["Retry-After"]) >= 1


def test_auth_register_returns_429_after_5_attempts(client):
    """6th register attempt from same IP must return 429."""
    for i in range(5):
        client.post(
            "/api/auth/register",
            json={"username": "x", "password": "y"},
        )
    r = client.post(
        "/api/auth/register",
        json={"username": "x", "password": "y"},
    )
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_login_and_register_use_separate_buckets(client):
    """Exhausting login must NOT block register (different endpoint key)."""
    # Burn login.
    for _ in range(6):
        client.post("/api/auth/login", json={"username": "x", "password": "y"})
    # Register must still work (will 400 on bad input, not 429).
    r = client.post(
        "/api/auth/register",
        json={"username": "ab", "password": "short"},  # below min length → 400
    )
    assert r.status_code == 400  # bad password length, NOT 429


def test_state_put_returns_429_after_30_attempts(client):
    """31st PUT /api/state from same IP must return 429.

    We authenticate first so the request hits the validation path, not 401.
    """
    # Register a user first (uses 1 register quota — well under 5).
    reg = client.post(
        "/api/auth/register",
        json={"username": "rateuser", "password": "longenough"},
    )
    assert reg.status_code == 201

    payload = {
        "state": {
            "publications": [],
            "questions": [],
            "researchers": [],
            "following": [],
            "bookmarks": [],
            "profile": {},
            "pages": [],
            "projects": [],
        },
        "revision": 0,
    }
    for i in range(30):
        r = client.put("/api/state", json=payload)
        assert r.status_code != 429, f"hit 429 early on attempt {i + 1}"
    r = client.put("/api/state", json=payload)
    assert r.status_code == 429
    assert "Retry-After" in r.headers


def test_rate_limit_reset_hook_works(app):
    """The _rate_limit_reset() hook clears all buckets (test-internal contract)."""
    import server

    with app.test_request_context("/"):
        server._rate_limit_check("auth_login")  # populate
    assert len(server._rate_limits) >= 1
    server._rate_limit_reset()
    assert server._rate_limits == {}


def test_trust_proxy_disabled_ignores_xff(client):
    """Without TRUST_PROXY=1, X-Forwarded-For is ignored — all test traffic
    uses the same key (the test client's remote_addr) so 5 requests still
    trigger the 6th-429."""
    for _ in range(5):
        client.post(
            "/api/auth/login",
            json={"username": "x", "password": "y"},
            headers={"X-Forwarded-For": "1.2.3.4"},
        )
    # Still 429 — XFF spoofing ignored.
    r = client.post(
        "/api/auth/login",
        json={"username": "x", "password": "y"},
        headers={"X-Forwarded-For": "5.6.7.8"},
    )
    assert r.status_code == 429


def test_trust_proxy_enabled_respects_xff(client_real, monkeypatch):
    """With TRUST_PROXY=1, two different X-Forwarded-For headers get separate
    buckets."""
    monkeypatch.setenv("TRUST_PROXY", "1")
    try:
        for _ in range(5):
            client_real.post(
                "/api/auth/login",
                json={"username": "x", "password": "y"},
                headers={"X-Forwarded-For": "1.1.1.1"},
            )
        # IP 1.1.1.1 is exhausted.
        r = client_real.post(
            "/api/auth/login",
            json={"username": "x", "password": "y"},
            headers={"X-Forwarded-For": "1.1.1.1"},
        )
        assert r.status_code == 429
        # IP 2.2.2.2 is fresh.
        r = client_real.post(
            "/api/auth/login",
            json={"username": "x", "password": "y"},
            headers={"X-Forwarded-For": "2.2.2.2"},
        )
        assert r.status_code != 429
    finally:
        monkeypatch.delenv("TRUST_PROXY", raising=False)
