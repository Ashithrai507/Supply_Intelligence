"""Shared contract types: enums, KPIs, alerts (frozen contract — issue #4)."""

from typing import Literal

from pydantic import BaseModel

ScenarioName = Literal["normal", "outbreak", "delay", "expiry_crisis", "competing", "combined"]
RiskLevel = Literal["critical", "warning", "ok"]


class Kpis(BaseModel):
    """Top-section dashboard KPIs (PLAN.md §6)."""

    facilities: int
    medicines: int
    critical_shortages: int
    expiry_risks: int
    recommended_transfers: int
    expected_shortage_units: int
    expected_wastage_units: int
    stockout_facilities: int


class Alert(BaseModel):
    severity: RiskLevel
    kind: Literal["stockout", "expiry"]
    facility_id: str
    facility_name: str
    medicine_id: str
    medicine_name: str
    message: str
    days_until_stockout: float | None = None
    units_at_risk: int | None = None
