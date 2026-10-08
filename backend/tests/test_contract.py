"""Contract tests — every frozen endpoint returns a contract-shaped payload (issue #4).

Auth (issue #8): all routes except /health require a Bearer token, so these
tests authenticate as ADMIN (full access). Negative auth cases live in
tests/test_auth.py.
"""

import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

TEST_SECRET = "test-jwt-secret-for-contract-32bytes!"

client = TestClient(app)


@pytest.fixture(autouse=True)
def _test_secret(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET)


def admin_headers() -> dict:
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "admin@demo.local",
            "aud": "authenticated",
            "iat": now,
            "exp": now + 3600,
            "app_metadata": {"role": "ADMIN", "facility_id": None},
        },
        TEST_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def test_health() -> None:
    assert client.get("/health").status_code == 200


def test_core_routes_match_contract() -> None:
    for path in (
        "/api/state",
        "/api/network",
        "/api/forecast/fac-001/med-001",
        "/api/transfers/tr-001/explain",
    ):
        resp = client.get(path, headers=admin_headers())
        assert resp.status_code == 200, f"{path} -> {resp.status_code}"
        assert isinstance(resp.json(), dict | list)


def test_state_contract_shape() -> None:
    body = client.get("/api/state", headers=admin_headers()).json()
    assert {"scenario", "kpis", "alerts", "risk_cards"} <= body.keys()
    kpi_keys = {
        "facilities", "medicines", "critical_shortages", "expiry_risks",
        "recommended_transfers", "expected_shortage_units",
        "expected_wastage_units", "stockout_facilities",
    }
    assert kpi_keys <= body["kpis"].keys()


def test_v1_endpoints_match_contract() -> None:
    for path in (
        "/api/v1/auth/me",
        "/api/v1/facilities",
        "/api/v1/medicines",
        "/api/v1/inventory",
        "/api/v1/demand",
        "/api/v1/forecasts",
        "/api/v1/risks/stockout",
        "/api/v1/risks/expiry",
        "/api/v1/redistribution/recommendations",
    ):
        resp = client.get(path, headers=admin_headers())
        assert resp.status_code == 200, f"{path} -> {resp.status_code}"


def test_post_endpoints_match_contract() -> None:
    headers = admin_headers()
    optimize = client.post(
        "/api/redistribution/optimize", json={"scenario": "outbreak"}, headers=headers
    )
    assert optimize.status_code == 200
    assert {"transfers", "before_kpis", "after_kpis"} <= optimize.json().keys()

    alias = client.post(
        "/api/v1/redistribution/optimize", json={"scenario": "normal"}, headers=headers
    )
    assert alias.status_code == 200

    copilot = client.post(
        "/api/copilot", json={"question": "Which hospitals are at risk?"}, headers=headers
    )
    assert copilot.status_code == 200
    assert {"answer", "citations"} <= copilot.json().keys()

    q = {"question": "What changes in an outbreak?"}
    assistant = client.post("/api/v1/assistant/query", json=q, headers=headers)
    assert assistant.status_code == 200

    scenario = client.post(
        "/api/v1/scenarios", json={"name": "t", "scenario": "combined"}, headers=headers
    )
    assert scenario.status_code == 201

    run = client.post("/api/v1/scenarios/scn-001/run", headers=headers)
    assert run.status_code == 200
    assert {"before_kpis", "after_kpis"} <= run.json().keys()

    forecast_run = client.post("/api/v1/forecasts/run", headers=headers)
    assert forecast_run.status_code == 200


def test_api_alias_medicines_for_frontend() -> None:
    """Frontend calls GET /api/medicines (forecast.ts) — the non-v1 alias must exist."""
    resp = client.get("/api/medicines")
    assert resp.status_code == 200, f"/api/medicines -> {resp.status_code}"
    body = resp.json()
    assert isinstance(body, list) and body
    assert {"id", "name", "category", "unit", "criticality_level"} <= body[0].keys()


def test_openapi_renders_all_routes() -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    for expected in ("/api/state", "/api/v1/risks/stockout", "/api/v1/scenarios/{scenario_id}/run"):
        assert expected in paths
