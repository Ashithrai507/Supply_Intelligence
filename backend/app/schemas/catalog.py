"""Catalog schemas: facilities, medicines, inventory, demand (project.md §12)."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class MeResponse(BaseModel):
    user_id: str
    email: str
    role: str
    facility_id: str | None = None


class Facility(BaseModel):
    id: str
    name: str
    type: str
    address: str
    latitude: float
    longitude: float
    patient_capacity: int
    avg_daily_patient_load: int
    emergency_capacity: int
    created_at: datetime | None = None


class Medicine(BaseModel):
    id: str
    name: str
    category: str
    unit: str
    criticality_level: int = Field(ge=1, le=5)
    alternative_group: str | None = None
    created_at: datetime | None = None


class InventoryItem(BaseModel):
    id: str
    facility_id: str
    medicine_id: str
    batch_number: str
    quantity: int
    reserved_quantity: int = 0
    received_date: date
    expiry_date: date


class InventoryCreate(BaseModel):
    facility_id: str
    medicine_id: str
    batch_number: str
    quantity: int
    received_date: date
    expiry_date: date


class DemandPoint(BaseModel):
    id: str
    facility_id: str
    medicine_id: str
    date: date
    quantity_consumed: int
    patient_load: int
    emergency_cases: int
    outbreak_signal: bool = False


class DemandCreate(BaseModel):
    facility_id: str
    medicine_id: str
    date: date
    quantity_consumed: int
    patient_load: int
    emergency_cases: int
    outbreak_signal: bool = False
