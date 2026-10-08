"""Forecast schemas — multi-horizon predictions (PLAN.md §5, issue #4)."""

from datetime import date, datetime

from pydantic import BaseModel


class HistoryPoint(BaseModel):
    date: date
    quantity: int


class HorizonPoint(BaseModel):
    date: date
    predicted_demand: float
    lower_bound: float  # q10
    upper_bound: float  # q90


class Quantiles(BaseModel):
    q10: list[float]
    q50: list[float]
    q90: list[float]


class ForecastBundle(BaseModel):
    """GET /api/forecast/{facility_id}/{medicine_id} (PLAN.md §5)."""

    facility_id: str
    medicine_id: str
    current_stock: int
    history: list[HistoryPoint]
    horizons: dict[str, list[HorizonPoint]]  # keys: d7, d14, d30
    quantiles: Quantiles


class ForecastRecord(BaseModel):
    """Persisted forecast row (project.md §12 forecasts)."""

    facility_id: str
    medicine_id: str
    forecast_date: date
    predicted_demand: float
    lower_bound: float
    upper_bound: float
    model_version: str
    created_at: datetime
