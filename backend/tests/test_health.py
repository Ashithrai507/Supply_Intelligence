"""Smoke tests for the scaffold (issue #2 acceptance criteria)."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_openapi_docs_render() -> None:
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert "Supply Intelligence API" in resp.json()["info"]["title"]
