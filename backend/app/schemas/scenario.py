"""Scenario schemas — what-if simulation (project.md §25, issue #16)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import Kpis, ScenarioName


class ScenarioCreate(BaseModel):
    name: str
    scenario: ScenarioName = "normal"
    knobs: dict[str, Any] = {}  # e.g. {"demand_multiplier": 1.7, "lead_time_days": 12}


class ScenarioResponse(BaseModel):
    id: str
    name: str
    scenario: ScenarioName
    knobs: dict[str, Any]
    status: str = "created"  # created | running | completed
    created_at: datetime | None = None


class ScenarioRunResponse(BaseModel):
    id: str
    status: str = "completed"
    before_kpis: Kpis
    after_kpis: Kpis
    summary: str
