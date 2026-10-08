"""Pydantic schemas for MedPredict MVP API contracts."""

from pydantic import BaseModel, Field


class HospitalSchema(BaseModel):
    id: str
    name: str
    city: str | None = None
    bed_capacity: int = 0
    avg_daily_patients: int = 0


class MedicineSchema(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    criticality_level: str


class BatchSchema(BaseModel):
    id: str
    batch_number: str
    quantity: int
    reserved_quantity: int
    usable_quantity: int
    received_date: str | None = None
    expiry_date: str
    days_to_expiry: int
    is_expired: bool
    potential_wastage: int = 0


class MedicineInventoryDetail(BaseModel):
    hospital_id: str
    medicine_id: str
    medicine_name: str
    category: str
    unit: str
    criticality_level: str
    total_quantity: int
    reserved_quantity: int
    usable_inventory: int
    expected_daily_demand: float
    days_of_supply: float
    projected_stockout_date: str | None = None
    days_until_stockout: float | None = None
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    batches: list[BatchSchema]
    incoming_purchase_orders_quantity: int = 0
    supplier_lead_time_days: int = 7


class ForecastPoint(BaseModel):
    date: str
    predicted_demand: float


class ForecastResponse(BaseModel):
    hospital_id: str
    medicine_id: str
    medicine_name: str | None = None
    horizon_days: int = 7
    forecast: list[ForecastPoint]
    historical: list[ForecastPoint] = Field(default_factory=list)
    model: str = "LightGBM"
    model_version: str = "1.0.0"
    metrics: dict[str, float] = Field(default_factory=dict)
    baseline_metrics: dict[str, float] = Field(default_factory=dict)


class StockoutRiskItem(BaseModel):
    hospital_id: str
    medicine_id: str
    medicine_name: str
    category: str
    criticality_level: str
    current_stock: int
    usable_stock: int
    daily_demand: float
    days_of_supply: float
    days_until_stockout: float | None = None
    projected_stockout_date: str | None = None
    risk_level: str  # CRITICAL, HIGH, MEDIUM, LOW


class ExpiryRiskItem(BaseModel):
    hospital_id: str
    medicine_id: str
    medicine_name: str
    batch_id: str
    batch_number: str
    quantity: int
    expiry_date: str
    days_to_expiry: int
    expected_consumption_before_expiry: float
    potential_wastage: int


class ProcurementRecommendation(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    category: str
    criticality_level: str
    recommended_quantity: int
    source_id: str | None = None
    source_name: str | None = None
    lead_time_days: int
    unit_price: float = 0.0
    estimated_cost: float = 0.0
    expected_delivery_date: str
    urgency: str  # CRITICAL, HIGH, MEDIUM
    reason: str


class SimpleRedistribution(BaseModel):
    medicine_id: str
    medicine_name: str
    source_name: str
    destination_hospital_name: str
    suggested_quantity: int
    reason: str


class SimulationRequest(BaseModel):
    hospital_id: str
    medicine_id: str
    demand_increase_pct: int = 0  # 0, 20, 40, 60


class SimulationComparison(BaseModel):
    baseline_stockout_date: str | None = None
    baseline_days_until_stockout: float | None = None
    baseline_risk_level: str
    baseline_recommended_order: int
    baseline_daily_demand: float

    simulated_stockout_date: str | None = None
    simulated_days_until_stockout: float | None = None
    simulated_risk_level: str
    simulated_recommended_order: int
    simulated_daily_demand: float

    demand_increase_pct: int
    multiplier: float
    summary: str


class DashboardKPIs(BaseModel):
    total_medicines: int
    critical_stockout_risks: int
    high_stockout_risks: int
    expiry_risk_batches: int
    total_potential_wastage_units: int
    pending_procurement_orders: int
    total_recommended_orders: int


class DashboardResponse(BaseModel):
    hospital: HospitalSchema
    kpis: DashboardKPIs
    critical_alerts: list[StockoutRiskItem]
    expiry_alerts: list[ExpiryRiskItem]
    top_recommendations: list[ProcurementRecommendation]
    redistribution_suggestions: list[SimpleRedistribution] = Field(default_factory=list)
