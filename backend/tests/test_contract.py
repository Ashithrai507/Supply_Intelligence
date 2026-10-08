"""Contract tests — every frozen endpoint returns a contract-shaped payload (issue #4)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    assert client.get("/health").status_code == 200


def test_core_routes_match_contract() -> None:
    for path in (
        "/api/state",
        "/api/network",
        "/api/forecast/fac-001/med-001",
        "/api/transfers/tr-001/explain",
    ):
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} -> {resp.status_code}"
        assert isinstance(resp.json(), dict | list)


def test_state_contract_shape() -> None:
    body = client.get("/api/state").json()
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
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} -> {resp.status_code}"


def test_post_endpoints_match_contract() -> None:
    optimize = client.post("/api/redistribution/optimize", json={"scenario": "outbreak"})
    assert optimize.status_code == 200
    assert {"transfers", "before_kpis", "after_kpis"} <= optimize.json().keys()

    alias = client.post("/api/v1/redistribution/optimize", json={"scenario": "normal"})
    assert alias.status_code == 200

    copilot = client.post("/api/copilot", json={"question": "Which hospitals are at risk?"})
    assert copilot.status_code == 200
    assert {"answer", "citations"} <= copilot.json().keys()

    q = {"question": "What changes in an outbreak?"}
    assistant = client.post("/api/v1/assistant/query", json=q)
    assert assistant.status_code == 200

    scenario = client.post("/api/v1/scenarios", json={"name": "t", "scenario": "combined"})
    assert scenario.status_code == 201

    run = client.post("/api/v1/scenarios/scn-001/run")
    assert run.status_code == 200
    assert {"before_kpis", "after_kpis"} <= run.json().keys()

    forecast_run = client.post("/api/v1/forecasts/run")
    assert forecast_run.status_code == 200


def test_openapi_renders_all_routes() -> None:
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]
    for expected in ("/api/state", "/api/v1/risks/stockout", "/api/v1/scenarios/{scenario_id}/run"):
        assert expected in paths
