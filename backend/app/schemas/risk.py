"""Risk schemas: stock-out + expiry cards (issues #14, #15 contract shapes)."""

from datetime import date

from pydantic import BaseModel

from app.schemas.common import RiskLevel


class StockoutRiskCard(BaseModel):
    facility_id: str
    facility_name: str
    medicine_id: str
    medicine_name: str
    current_stock: int
    predicted_daily_demand: float
    supplier_lead_time_days: int
    days_until_stockout: float | None  # None = no stock-out within horizon
    stockout_probability: float  # 0..1
    risk_level: RiskLevel
    reasons: list[str]


class ExpiryRiskCard(BaseModel):
    facility_id: str
    facility_name: str
    medicine_id: str
    medicine_name: str
    batch_number: str
    quantity: int
    expiry_date: date
    days_to_expiry: int
    expected_use_before_expiry: int
    units_at_risk: int
    risk_level: RiskLevel
