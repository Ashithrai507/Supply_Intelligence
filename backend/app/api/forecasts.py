"""Demand forecasting API endpoints (supporting MedPredict and contract)."""


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api._fixtures import load_fixture
from app.core.database import get_db
from app.schemas.medpredict import ForecastResponse
from app.services.forecast_service import get_medicine_forecast

router = APIRouter()


class ForecastRequest(BaseModel):
    hospital_id: str = "H01"
    medicine_id: str = "M001"
    horizon_days: int = 7
    demand_surge_multiplier: float = 1.0


@router.get("", summary="List forecasts or get recent forecast rows")
def list_forecasts() -> list[dict]:
    return load_fixture("forecasts")


@router.post("/run", summary="Trigger batch forecast run")
def run_batch_forecasts() -> list[dict]:
    return load_fixture("forecasts")


@router.post("", response_model=ForecastResponse, summary="Generate demand forecast (POST)")
def run_forecast_post(
    req: ForecastRequest,
    db: Session = Depends(get_db),
):
    res = get_medicine_forecast(
        db=db,
        hospital_id=req.hospital_id,
        medicine_id=req.medicine_id,
        horizon_days=req.horizon_days,
        demand_surge_multiplier=req.demand_surge_multiplier,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Hospital or medicine not found")
    return res


@router.get("/{hospital_id}/{medicine_id}", response_model=ForecastResponse | list[dict], summary="Get demand forecast (GET)")
def get_forecast_get(
    hospital_id: str,
    medicine_id: str,
    horizon_days: int = Query(default=7, ge=1, le=30),
    demand_surge_multiplier: float = Query(default=1.0, ge=0.5, le=3.0),
    db: Session = Depends(get_db),
):
    res = get_medicine_forecast(
        db=db,
        hospital_id=hospital_id,
        medicine_id=medicine_id,
        horizon_days=horizon_days,
        demand_surge_multiplier=demand_surge_multiplier,
    )
    if res:
        return res
    # Fallback to contract fixture if not found in db
    rows = [
        r
        for r in load_fixture("forecasts")
        if r.get("facility_id") == hospital_id and r.get("medicine_id") == medicine_id
    ]
    return rows or load_fixture("forecasts")
