"""End-to-end smoke for Phase 2/3 changes: limit, secure cookie, identifiers,
focus-trap semantics don't break basic flows."""

from __future__ import annotations


def test_register_login_logout_round_trip(client):
    """Basic happy path still works with rate-limit + cookie changes in place."""
    r = client.post(
        "/api/auth/register",
        json={"username": "smoke_user", "password": "longenough"},
    )
    assert r.status_code == 201
    cookies = r.headers.getlist("Set-Cookie")
    # Cookie must be HttpOnly + SameSite=Lax; Secure depends on transport.
    assert any("HttpOnly" in c for c in cookies)
    assert any("SameSite=Lax" in c for c in cookies)

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["user"]["username"] == "smoke_user"

    state = client.get("/api/state")
    assert state.status_code == 200
    payload = state.get_json()
    assert payload["revision"] == 0
    assert "publications" in payload["state"]

    r = client.post("/api/auth/logout")
    assert r.status_code == 200

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.get_json()["user"] is None


def test_index_html_has_aria_busy_on_grid(client):
    """The pubGrid container must announce aria-busy so screen readers know
    when content is pending (a11y P0-11)."""
    r = client.get("/")
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert 'id="pubGrid"' in html
    # The attribute itself must be present and start as false.
    assert 'aria-busy="false"' in html


def test_stylesheet_has_focus_visible_rule(client):
    """The :focus-visible rule must ship so keyboard users see a focus ring
    (a11y P0-12)."""
    r = client.get("/workspace.css")
    assert r.status_code == 200
    css = r.get_data(as_text=True)
    # styles.css is the served one and includes the :focus-visible block we
    # added in styles.css.orig (synced).
    r2 = client.get("/styles.css")
    css2 = r2.get_data(as_text=True)
    combined = css + css2
    assert ":focus-visible" in combined
    assert "outline: 2px solid" in combined
