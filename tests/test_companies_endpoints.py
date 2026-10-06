"""/companies endpoints - DB calls mocked. GET /companies is public; the
follow routes require sign-in, so auth is overridden per-test where needed."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from jobsentinel.api.auth import get_current_user_id
from jobsentinel.api.main import app

client = TestClient(app)

TEST_USER_ID = "user_test123"


@pytest.fixture
def fake_auth():
    """Same override as tests/test_jobs_endpoints.py's fake_auth, but NOT
    autouse here - test_follow_routes_require_auth needs the real
    dependency to prove these routes reject anonymous callers."""
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID
    yield
    del app.dependency_overrides[get_current_user_id]


def test_list_all_companies(monkeypatch):
    fake_company = {
        "id": 1,
        "name": "Anthropic",
        "source": "greenhouse",
        "board_token": "anthropic",
        "created_at": "2026-10-02T00:00:00Z",
    }
    monkeypatch.setattr(
        "jobsentinel.api.routers.companies.list_companies", lambda engine: [fake_company]
    )

    response = client.get("/companies")

    assert response.status_code == 200
    assert response.json() == [
        {"id": 1, "name": "Anthropic", "source": "greenhouse", "board_token": "anthropic"}
    ]


# ---- GET /companies/following ------------------------------------------


def test_list_following_scopes_to_current_user(monkeypatch, fake_auth):
    seen = {}

    def fake_list(engine, user_id):
        seen["user_id"] = user_id
        return [{
            "id": 1,
            "name": "Anthropic",
            "source": "greenhouse",
            "board_token": "anthropic",
            "followed_at": "2026-10-05T12:00:00Z",
        }]

    monkeypatch.setattr(
        "jobsentinel.api.routers.companies.list_followed_companies", fake_list
    )

    response = client.get("/companies/following")

    assert response.status_code == 200
    assert seen["user_id"] == TEST_USER_ID
    assert response.json() == [{
        "id": 1,
        "name": "Anthropic",
        "source": "greenhouse",
        "board_token": "anthropic",
        "followed_at": "2026-10-05T12:00:00Z",
    }]


def test_list_following_isolates_users(monkeypatch):
    """User A can't see user B's follows: the route passes the TOKEN's user
    to the db layer, so even with both users' rows present, each caller
    only gets their own back."""
    rows_by_user = {
        "user_a": [{"id": 1, "name": "Anthropic", "source": "greenhouse",
                    "board_token": "anthropic", "followed_at": "2026-10-05T12:00:00Z"}],
        "user_b": [{"id": 5, "name": "Stripe", "source": "greenhouse",
                    "board_token": "stripe", "followed_at": "2026-10-05T12:00:00Z"}],
    }
    monkeypatch.setattr(
        "jobsentinel.api.routers.companies.list_followed_companies",
        lambda engine, user_id: rows_by_user.get(user_id, []),
    )

    try:
        for user_id, expected_id in (("user_a", 1), ("user_b", 5)):
            app.dependency_overrides[get_current_user_id] = lambda u=user_id: u
            response = client.get("/companies/following")
            assert [c["id"] for c in response.json()] == [expected_id]
    finally:
        del app.dependency_overrides[get_current_user_id]


# ---- PUT/DELETE /companies/{id}/follow ---------------------------------


@pytest.mark.parametrize("already_following", [False, True])
def test_follow_returns_204(monkeypatch, fake_auth, already_following):
    calls = []

    def fake_follow(engine, user_id, company_id):
        calls.append((user_id, company_id))
        return not already_following

    monkeypatch.setattr("jobsentinel.api.routers.companies.follow_company", fake_follow)

    response = client.put("/companies/7/follow")

    # Same response either way - follow is idempotent.
    assert response.status_code == 204
    assert response.content == b""
    assert calls == [(TEST_USER_ID, 7)]


def test_follow_unknown_company_404s(monkeypatch, fake_auth):
    def fake_follow(engine, user_id, company_id):
        raise IntegrityError("INSERT ...", {}, Exception("fk violation"))

    monkeypatch.setattr("jobsentinel.api.routers.companies.follow_company", fake_follow)

    response = client.put("/companies/999/follow")

    assert response.status_code == 404


@pytest.mark.parametrize("was_following", [False, True])
def test_unfollow_returns_204(monkeypatch, fake_auth, was_following):
    calls = []

    def fake_unfollow(engine, user_id, company_id):
        calls.append((user_id, company_id))
        return was_following

    monkeypatch.setattr("jobsentinel.api.routers.companies.unfollow_company", fake_unfollow)

    response = client.delete("/companies/7/follow")

    assert response.status_code == 204
    assert calls == [(TEST_USER_ID, 7)]


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/companies/following"),
        ("put", "/companies/7/follow"),
        ("delete", "/companies/7/follow"),
    ],
)
def test_follow_routes_require_auth(method, path):
    # No fake_auth: the real dependency runs and rejects the missing bearer
    # token before the route body (and any DB call) executes.
    response = getattr(client, method)(path)

    assert response.status_code in (401, 403)
