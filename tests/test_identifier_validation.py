"""Tests for the server-side identifier validators (DOI / ORCID).

These mirror the regex in app.js.orig:24-25 but enforce on the server so a
raw PUT can't bypass the frontend UI checks.
"""

from __future__ import annotations


def _login(client, username="validuser", password="longenough"):
    r = client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    # 201 = new, 409 = already exists (fine for re-runs)
    assert r.status_code in (201, 409)
    # Ensure we have a session cookie even if the user already existed.
    if r.status_code == 409:
        r = client.post(
            "/api/auth/login",
            json={"username": username, "password": password},
        )
        assert r.status_code == 200


def _put_state(client, state, revision=0):
    return client.put("/api/state", json={"state": state, "revision": revision})


def test_valid_doi_passes(client):
    _login(client)
    r = _put_state(
        client,
        {
            "publications": [{"doi": "10.5194/acp-23-12345-2023", "title": "ok"}],
            "questions": [], "researchers": [], "following": [],
            "bookmarks": [], "profile": {}, "pages": [], "projects": [],
        },
    )
    assert r.status_code == 200, r.get_json()


def test_invalid_doi_rejected(client):
    _login(client)
    r = _put_state(
        client,
        {
            "publications": [{"doi": "<script>alert(1)</script>", "title": "bad"}],
            "questions": [], "researchers": [], "following": [],
            "bookmarks": [], "profile": {}, "pages": [], "projects": [],
        },
    )
    assert r.status_code == 400
    assert "doi" in r.get_json()["error"].lower()


def test_missing_doi_is_allowed(client):
    _login(client)
    r = _put_state(
        client,
        {
            "publications": [{"title": "no doi at all"}],  # no doi field
            "questions": [], "researchers": [], "following": [],
            "bookmarks": [], "profile": {}, "pages": [], "projects": [],
        },
    )
    assert r.status_code == 200


def test_empty_string_doi_is_allowed(client):
    _login(client)
    r = _put_state(
        client,
        {
            "publications": [{"doi": "", "title": "blank doi"}],
            "questions": [], "researchers": [], "following": [],
            "bookmarks": [], "profile": {}, "pages": [], "projects": [],
        },
    )
    assert r.status_code == 200


def test_valid_orcid_passes(client):
    _login(client, "orcid_user1")
    r = _put_state(
        client,
        {
            "publications": [],
            "questions": [],
            "researchers": [{"orcid": "0000-0002-1825-0097", "name": "ok"}],
            "following": [], "bookmarks": [], "profile": {}, "pages": [],
            "projects": [],
        },
    )
    assert r.status_code == 200


def test_invalid_orcid_rejected(client):
    _login(client, "orcid_user2")
    r = _put_state(
        client,
        {
            "publications": [],
            "questions": [],
            "researchers": [{"orcid": "not-an-orcid", "name": "bad"}],
            "following": [], "bookmarks": [], "profile": {}, "pages": [],
            "projects": [],
        },
    )
    assert r.status_code == 400
    assert "orcid" in r.get_json()["error"].lower()


def test_orcid_with_checksum_x_accepted(client):
    """ORCID allows the final character to be X (checksum digit)."""
    _login(client, "orcid_user3")
    # Real example: 0000-0001-2345-678X
    r = _put_state(
        client,
        {
            "publications": [],
            "questions": [],
            "researchers": [{"orcid": "0000-0001-2345-678X", "name": "ok"}],
            "following": [], "bookmarks": [], "profile": {}, "pages": [],
            "projects": [],
        },
    )
    assert r.status_code == 200
