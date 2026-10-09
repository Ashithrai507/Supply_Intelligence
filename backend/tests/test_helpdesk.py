"""Tests for the MedPredict Helpdesk (grounded Groq assistant).

Layers under test:
  1. Tool layer — every handler runs against the real seeded DB and service
     layer, scoped to ``HelpdeskScope`` (hospital can never be spoofed).
  2. Answer assembly — numerical-claim grounding guard, JSON parsing.
  3. API layer — scope resolution (header + JWT authority), 401/503/502 paths,
     capabilities endpoint; Groq is always mocked.
"""

from __future__ import annotations

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core import groq_client
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import HelpdeskScope
from app.main import app
from app.services.helpdesk_service import (
    HelpdeskBadResponseError,
    _dispatch,
    _parse_answer,
    _unverified_numbers,
    answer_question,
)

H01 = HelpdeskScope(hospital_id="H01", hospital_name="Hospital A", role="ADMIN")


@pytest.fixture(scope="module")
def db() -> Session:
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tool layer (real DB + real service functions, hospital scope injected)
# ---------------------------------------------------------------------------

def test_tool_stockout_risks(db: Session):
    out = _dispatch(db, H01, "get_stockout_risks", {})
    assert "rows" in out and out["rows"]
    for row in out["rows"]:
        assert row["hospital"] == "Hospital A"
        assert row["risk"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
    assert out["note"] is None


def test_tool_expiry_risks_empty_note(db: Session):
    out = _dispatch(db, H01, "get_expiry_risks", {})
    assert out["rows"] == []
    assert "No batches" in out["note"]


def test_tool_inventory_lookup(db: Session):
    out = _dispatch(db, H01, "get_inventory_lookup", {"medicine_id": "M001"})
    assert len(out["rows"]) == 1
    row = out["rows"][0]
    assert row["medicine"] == "Medicine 001"
    assert row["total_quantity"] is not None
    assert row["risk"] is not None


def test_tool_inventory_lookup_ignores_spoofed_hospital(db: Session):
    out = _dispatch(db, H01, "get_inventory_lookup", {"hospital_id": "H08", "medicine_id": "M001"})
    assert out["rows"][0]["hospital"] == "Hospital A"


def test_tool_inventory_lookup_unknown_medicine(db: Session):
    out = _dispatch(db, H01, "get_inventory_lookup", {"medicine_name": "Not A Medicine"})
    assert "error" in out
    assert "No medicine matching" in out["error"]


def test_tool_forecast_splits_history_and_prediction(db: Session):
    out = _dispatch(db, H01, "get_demand_forecast", {"medicine_id": "M001", "horizon_days": 7})
    rows = out["rows"]
    forecast_rows = [r for r in rows if r["is_forecast"]]
    history_rows = [r for r in rows if not r["is_forecast"]]
    assert len(forecast_rows) == 7
    assert history_rows
    assert all(r["predicted_demand"] > 0 for r in forecast_rows)
    assert "model predictions" in out["note"]


def test_tool_forecast_invalid_horizon(db: Session):
    out = _dispatch(db, H01, "get_demand_forecast", {"medicine_id": "M001", "horizon_days": "many"})
    assert "error" in out


def test_tool_procurement_scoped(db: Session):
    out = _dispatch(db, H01, "get_procurement_recommendations", {"hospital_id": "H04"})
    assert out["rows"]
    for row in out["rows"]:
        assert row["hospital"] == "Hospital A"
        assert row["suggested_quantity"] is not None
        assert row["urgency"] in {"CRITICAL", "HIGH", "MEDIUM"}


def test_tool_risk_explanation(db: Session):
    out = _dispatch(db, H01, "explain_risk", {"medicine_id": "M001"})
    assert len(out["rows"]) == 1
    assert out["rows"][0]["medicine"] == "Medicine 001"
    assert out["rows"][0]["detail"]  # reason text


def test_tool_capabilities(db: Session):
    out = _dispatch(db, H01, "get_capabilities", {})
    assert len(out["rows"]) == 7


def test_tool_unknown_name(db: Session):
    out = _dispatch(db, H01, "drop_database", {})
    assert out["error"] == "Unknown tool: 'drop_database'"


# ---------------------------------------------------------------------------
# Answer assembly
# ---------------------------------------------------------------------------

def test_parse_answer_handles_code_fences():
    text = "```json\n{\"answer\": \"A\", \"suggested_questions\": [\"Q1\"]}\n```"
    assert _parse_answer(text)["answer"] == "A"
    assert _parse_answer(text)["suggested_questions"] == ["Q1"]


def test_parse_answer_rejects_garbage():
    with pytest.raises(HelpdeskBadResponseError):
        _parse_answer("Sure, 100 units — definitely.")


def test_unverified_numbers_guard():
    from app.schemas.helpdesk import EvidenceRow

    rows = [EvidenceRow(hospital="Hospital A", medicine="Medicine 001", risk="HIGH")]
    assert _unverified_numbers("Stock-out in 3 days", rows, "2026-10-01") == ["3"]
    assert _unverified_numbers("Risk HIGH for Medicine 001", rows, "2026-10-01") == []
    assert _unverified_numbers("Cut by 123456 units", rows, "2026-10-01") == ["123456"]


def test_answer_question_marks_fabricated_number(monkeypatch, db):
    monkeypatch.setattr(groq_client, "build_client", lambda: object())
    real_dispatch = _dispatch

    def fake_loop(client, model, system, question, tools, handler):
        result = real_dispatch(db, H01, "get_stockout_risks", {})
        return (
            '{"answer": "Stock-out in 4 days for 123456 units.", "suggested_questions": []}',
            "get_stockout_risks",
            result,
        )

    monkeypatch.setattr(groq_client, "run_grounded_query", fake_loop)
    from app.schemas.helpdesk import HelpdeskRequest

    response = answer_question(db, H01, HelpdeskRequest(question="any stock-out?"))
    assert response.intent == "highest_stockout_risk"
    assert response.evidence
    assert any("could not be verified" in lim for lim in response.limitations)


# ---------------------------------------------------------------------------
# API layer (Groq mocked)
# ---------------------------------------------------------------------------

@pytest.fixture()
def fake_groq(monkeypatch):
    """Routes answer_question through the real handlers with a canned text reply."""
    sentinel = object()

    def _install(final_text: str, tool_name: str | None):
        monkeypatch.setattr(groq_client, "build_client", lambda: sentinel)

        def fake_loop(client, model, system, question, tools, handler):
            result = None
            if tool_name:
                result = handler(tool_name, {})
            return final_text, tool_name, result

        monkeypatch.setattr(groq_client, "run_grounded_query", fake_loop)

    return _install


def test_query_requires_scope(client: TestClient):
    assert client.post("/api/v1/helpdesk/query", json={"question": "hi"}).status_code == 401


def test_query_rejects_unknown_hospital(client: TestClient):
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "hi"},
        headers={"X-Hospital-Id": "H999"},
    )
    assert r.status_code == 401


def test_query_returns_grounded_answer(client: TestClient, fake_groq):
    fake_groq(
        '{"answer": "Three medicines are flagged for stock-out risk.", "suggested_questions": ["Which one first?"]}',
        "get_stockout_risks",
    )
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "Which medicines are at highest risk?"},
        headers={"X-Hospital-Id": "H01"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["intent"] == "highest_stockout_risk"
    assert body["data_as_of"] == "2026-10-01"
    assert body["evidence"]
    assert body["evidence"][0]["hospital"] == "Hospital A"
    assert body["suggested_questions"] == ["Which one first?"]


def test_query_no_tool_maps_to_limitation(client: TestClient, fake_groq):
    fake_groq('{"answer": "I can only help with MedPredict data.", "suggested_questions": []}', None)
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "What is the weather?"},
        headers={"X-Hospital-Id": "H01"},
    )
    assert r.status_code == 200
    assert r.json()["intent"] == "limitation"


def test_query_malformed_answer_returns_502(client: TestClient, fake_groq, monkeypatch):
    monkeypatch.setattr(groq_client, "build_client", lambda: object())

    def fake_loop(client, model, system, question, tools, handler):
        return "I made up 999 units", "get_stockout_risks", {"rows": []}

    monkeypatch.setattr(groq_client, "run_grounded_query", fake_loop)
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "stock-out?"},
        headers={"X-Hospital-Id": "H01"},
    )
    assert r.status_code == 502


def test_query_groq_down_returns_503(client: TestClient, monkeypatch):
    def boom():
        from app.core.groq_client import GroqUnavailableError

        raise GroqUnavailableError("no key")

    monkeypatch.setattr(groq_client, "build_client", boom)
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "stock-out?"},
        headers={"X-Hospital-Id": "H01"},
    )
    assert r.status_code == 503
    assert r.json()["detail"] == "Helpdesk temporarily unavailable"


def test_invalid_tool_call_is_grounded(client: TestClient, monkeypatch):
    """Model picks a bad medicine → handler returns error → 200 answer, no rows."""
    monkeypatch.setattr(groq_client, "build_client", lambda: object())
    real_dispatch = _dispatch

    def fake_loop(client, model, system, question, tools, handler):
        with SessionLocal() as session:
            result = real_dispatch(session, H01, "get_inventory_lookup", {"medicine_name": "Nope"})
        return (
            '{"answer": "No medicine records exist for it.", "suggested_questions": []}',
            "get_inventory_lookup",
            result,
        )

    monkeypatch.setattr(groq_client, "run_grounded_query", fake_loop)
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "inventory of Nope?"},
        headers={"X-Hospital-Id": "H01"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["evidence"] == []
    assert any("No medicine matching" in lim for lim in body["limitations"])


def test_bearer_jwt_authoritative_over_header(client: TestClient, monkeypatch):
    """A valid JWT's facility_id beats a conflicting X-Hospital-Id header."""
    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "helpdesk-test-secret")
    token = jwt.encode(
        {
            "sub": "u-1",
            "aud": "authenticated",
            "exp": 9999999999,
            "app_metadata": {"role": "ADMIN", "facility_id": "H03"},
        },
        "helpdesk-test-secret",
        algorithm="HS256",
    )
    monkeypatch.setattr(groq_client, "build_client", lambda: object())

    def fake_loop(client, model, system, question, tools, handler):
        result = handler("get_stockout_risks", {})
        return (
            '{"answer": "Several medicines are flagged.", "suggested_questions": []}',
            "get_stockout_risks",
            result,
        )

    monkeypatch.setattr(groq_client, "run_grounded_query", fake_loop)
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "list inventory"},
        headers={"Authorization": f"Bearer {token}", "X-Hospital-Id": "H01"},
    )
    assert r.status_code == 200
    assert r.json()["evidence"][0]["hospital"] == "Hospital C"


def test_invalid_bearer_rejected(client: TestClient):
    r = client.post(
        "/api/v1/helpdesk/query",
        json={"question": "hi"},
        headers={"Authorization": "Bearer not-a-jwt", "X-Hospital-Id": "H01"},
    )
    assert r.status_code == 401


def test_capabilities_endpoint(client: TestClient):
    assert client.get("/api/v1/helpdesk/capabilities").status_code == 401
    r = client.get("/api/v1/helpdesk/capabilities", headers={"X-Hospital-Id": "H01"})
    assert r.status_code == 200
    intents = [c["intent"] for c in r.json()]
    assert intents == [
        "highest_stockout_risk",
        "expiry_risk",
        "inventory_lookup",
        "demand_forecast",
        "procurement_recommendations",
        "risk_explanation",
        "helpdesk_capabilities",
    ]