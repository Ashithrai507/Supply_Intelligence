"""Integration and unit tests for MedPredict MVP pipeline."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import DemandHistory, Hospital, Medicine
from app.services.forecast_service import get_medicine_forecast
from app.services.inventory_service import calculate_medicine_inventory
from app.services.procurement_service import generate_procurement_recommendations
from app.services.risk_service import get_expiry_risks
from app.services.simulation_service import run_demand_simulation
from ml.forecaster import get_model_metrics


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_1_database_and_dataset_loaded(db: Session):
    """Verify master data and demand history are populated."""
    hospitals_count = db.query(Hospital).count()
    medicines_count = db.query(Medicine).count()
    demand_count = db.query(DemandHistory).count()

    assert hospitals_count >= 8, f"Expected at least 8 hospitals, got {hospitals_count}"
    assert medicines_count >= 50, f"Expected at least 50 medicines, got {medicines_count}"
    assert demand_count >= 100000, f"Expected >=100k demand rows, got {demand_count}"


def test_2_model_metrics_and_baseline():
    """Verify LightGBM model metrics exist and compare against 7-day baseline."""
    metrics = get_model_metrics()
    assert "lightgbm" in metrics
    assert "baseline_7day_ma" in metrics

    lgb_wape = metrics["lightgbm"]["wape"]
    base_wape = metrics["baseline_7day_ma"]["wape"]

    assert lgb_wape > 0
    assert base_wape > 0
    # LightGBM must beat or perform competitively against baseline
    assert lgb_wape <= base_wape


def test_3_forecast_service_and_dates(db: Session):
    """Verify multi-day forecast returns future dates and positive quantities."""
    fc = get_medicine_forecast(db, hospital_id="H01", medicine_id="M001", horizon_days=7)
    assert fc is not None
    assert len(fc.forecast) == 7
    assert len(fc.historical) > 0

    # Ensure dates are chronologically increasing
    dates = [p.date for p in fc.forecast]
    assert dates == sorted(dates)
    for p in fc.forecast:
        assert p.predicted_demand > 0


def test_4_stock_simulation_and_days_of_supply(db: Session):
    """Verify deterministic inventory simulation and DOS calculation."""
    inv = calculate_medicine_inventory(db, hospital_id="H01", medicine_id="M001")
    assert inv is not None
    assert inv.usable_inventory >= 0
    assert inv.expected_daily_demand > 0
    assert inv.days_of_supply >= 0
    assert inv.risk_level in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}


def test_5_expiry_risk_calculation(db: Session):
    """Verify expiry risk logic identifies batches at risk."""
    expiry_items = get_expiry_risks(db, hospital_id="H01")
    assert isinstance(expiry_items, list)
    for exp in expiry_items:
        assert exp.potential_wastage > 0
        assert exp.days_to_expiry is not None


def test_6_procurement_recommendation(db: Session):
    """Verify procurement calculation respects lead time and required inventory."""
    recs = generate_procurement_recommendations(db, hospital_id="H01")
    assert isinstance(recs, list)
    for r in recs:
        assert r.recommended_quantity > 0
        assert r.lead_time_days > 0
        assert r.urgency in {"CRITICAL", "HIGH", "MEDIUM"}
        assert len(r.reason) > 0


def test_7_what_if_demand_surge_simulation(db: Session):
    """Verify what-if simulation accelerates stock-out and increases procurement requirements."""
    res = run_demand_simulation(db, hospital_id="H01", medicine_id="M001", demand_increase_pct=40)
    assert res is not None
    assert res.simulated_daily_demand > res.baseline_daily_demand
    assert res.multiplier == 1.4
    assert len(res.summary) > 0


def test_8_api_endpoints_end_to_end(client: TestClient):
    """Verify all REST API endpoints return contract responses."""
    # Health
    r = client.get("/health")
    assert r.status_code == 200

    # Hospitals
    r = client.get("/api/v1/hospitals")
    assert r.status_code == 200
    assert len(r.json()) >= 8

    # Medicines
    r = client.get("/api/v1/medicines")
    assert r.status_code == 200
    assert len(r.json()) >= 50

    # Dashboard
    r = client.get("/api/v1/dashboard?hospital_id=H01")
    assert r.status_code == 200
    dash = r.json()
    assert "kpis" in dash
    assert dash["kpis"]["total_medicines"] == 50

    # Forecast
    r = client.post("/api/v1/forecast", json={"hospital_id": "H01", "medicine_id": "M001", "horizon_days": 7})
    assert r.status_code == 200
    assert len(r.json()["forecast"]) == 7

    # Simulation
    r = client.post("/api/v1/simulation/run", json={"hospital_id": "H01", "medicine_id": "M001", "demand_increase_pct": 40})
    assert r.status_code == 200
    assert r.json()["demand_increase_pct"] == 40
