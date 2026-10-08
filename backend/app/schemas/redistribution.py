"""Redistribution schemas: transfers, optimization, explanation (issues #7, #12)."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import Kpis, ScenarioName


class Transfer(BaseModel):
    id: str
    source_facility_id: str
    source_facility_name: str
    destination_facility_id: str
    destination_facility_name: str
    medicine_id: str
    medicine_name: str
    quantity: int
    distance_km: float
    eta_hours: float
    priority_score: float = Field(ge=0, le=100)
    reason: str


class Recommendation(Transfer):
    batch_id: str | None = None
    status: str = "proposed"  # proposed | accepted | rejected | completed
    created_at: datetime | None = None


class OptimizeRequest(BaseModel):
    scenario: ScenarioName = "normal"


class OptimizeResponse(BaseModel):
    transfers: list[Transfer]
    before_kpis: Kpis
    after_kpis: Kpis


class ExplainResponse(BaseModel):
    """Deterministic reason card — every number checkable (no LLM)."""

    transfer_id: str
    reasons: list[str]
    numbers: dict[str, float | int | str]
