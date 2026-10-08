"""Auth tests — JWT verification + RBAC (issue #8 acceptance criteria).

Covers: valid token passes (per role), missing/invalid/expired → 401,
wrong role on admin-only routes → 403, /health stays public, /me reflects
the caller, OpenAPI exposes the Bearer security scheme.
"""

import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.core.config import settings
from app.main import app

TEST_SECRET = "test-jwt-secret-for-issue-8-32bytes!!"

client = TestClient(app)


@pytest.fixture(autouse=True)
def _test_secret(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


def mint(role: str, facility_id: str | None = None, expired: bool = False) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": f"{role.lower()}@demo.local",
            "aud": "authenticated",
            "iat": now - (7200 if expired else 0),
            "exp": now - 10 if expired else now + 3600,
            "app_metadata": {
                "role": role,
                "facility_id": facility_id,
            },
        },
        TEST_SECRET,
        algorithm="HS256",
    )


def auth_headers(role: str, **kwargs) -> dict:
    return {"Authorization": f"Bearer {mint(role, **kwargs)}"}


def test_health_is_public() -> None:
    assert client.get("/health").status_code == 200


def test_missing_token_is_401() -> None:
    assert client.get("/api/state").status_code == 401


def test_invalid_token_is_401() -> None:
    resp = client.get("/api/state", headers={"Authorization": "Bearer garbage.token.here"})
    assert resp.status_code == 401


def test_expired_token_is_401() -> None:
    resp = client.get("/api/state", headers=auth_headers("ADMIN", expired=True))
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()


def test_unknown_role_is_401() -> None:
    token = jwt.encode(
        {
            "sub": "u1",
            "aud": "authenticated",
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "app_metadata": {"role": "SUPERUSER"},
        },
        TEST_SECRET,
        algorithm="HS256",
    )
    resp = client.get("/api/state", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_all_roles_can_read() -> None:
    for role in ("ADMIN", "FACILITY_MANAGER", "ANALYST"):
        resp = client.get("/api/state", headers=auth_headers(role))
        assert resp.status_code == 200, f"{role} should read /api/state"


def test_me_reflects_caller() -> None:
    fid = "00000000-0000-0000-0000-00000000fac1"
    resp = client.get("/api/v1/auth/me", headers=auth_headers("FACILITY_MANAGER", facility_id=fid))
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "FACILITY_MANAGER"
    assert body["facility_id"] == fid


def test_admin_can_run_optimize() -> None:
    resp = client.post(
        "/api/redistribution/optimize",
        json={"scenario": "outbreak"},
        headers=auth_headers("ADMIN"),
    )
    assert resp.status_code == 200


def test_analyst_and_manager_cannot_run_optimize() -> None:
    for role in ("ANALYST", "FACILITY_MANAGER"):
        resp = client.post(
            "/api/redistribution/optimize",
            json={"scenario": "outbreak"},
            headers=auth_headers(role),
        )
        assert resp.status_code == 403, f"{role} should be forbidden from optimize"


def test_analyst_cannot_create_scenario() -> None:
    resp = client.post(
        "/api/v1/scenarios",
        json={"name": "t", "scenario": "combined"},
        headers=auth_headers("ANALYST"),
    )
    assert resp.status_code == 403


def test_openapi_has_bearer_security_scheme() -> None:
    spec = client.get("/openapi.json").json()
    schemes = spec.get("components", {}).get("securitySchemes", {})
    assert "HTTPBearer" in schemes


def test_auth_unconfigured_is_401(monkeypatch) -> None:
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "")
    resp = client.get("/api/state", headers=auth_headers("ADMIN"))
    assert resp.status_code == 401
    assert security.jwt_secret_configured() is False
