"""Forecast endpoints (project.md §13). Model runs land in issue #13."""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.forecast import ForecastRecord

router = APIRouter()


@router.get("", response_model=list[ForecastRecord], summary="Recent forecast rows")
def list_forecasts() -> list[dict]:
    return load_fixture("forecasts")


@router.get(
    "/{facility_id}/{medicine_id}",
    response_model=list[ForecastRecord],
    summary="Forecasts for one facility×medicine",
)
def get_forecasts(facility_id: str, medicine_id: str) -> list[dict]:
    rows = [
        r
        for r in load_fixture("forecasts")
        if r["facility_id"] == facility_id and r["medicine_id"] == medicine_id
    ]
    return rows or load_fixture("forecasts")


@router.post("/run", response_model=list[ForecastRecord], summary="Trigger forecast run (mock)")
def run_forecasts() -> list[dict]:
    return load_fixture("forecasts")
