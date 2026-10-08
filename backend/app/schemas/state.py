"""Dashboard state + network schemas (PLAN.md §5 /api/state, /api/network)."""

from pydantic import BaseModel

from app.schemas.common import Alert, Kpis, RiskLevel, ScenarioName
from app.schemas.risk import StockoutRiskCard


class StateResponse(BaseModel):
    scenario: ScenarioName
    kpis: Kpis
    alerts: list[Alert]
    risk_cards: list[StockoutRiskCard]


class NetworkNode(BaseModel):
    id: str
    name: str
    type: str
    latitude: float
    longitude: float
    risk_level: RiskLevel


class NetworkEdge(BaseModel):
    source_id: str
    destination_id: str
    distance_km: float
    transport_time_hours: float
    transport_capacity: int
    active_transfer_units: int = 0


class NetworkResponse(BaseModel):
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
