"""Inventory endpoints (project.md §13)."""

from fastapi import APIRouter, HTTPException

from app.api._fixtures import load_fixture
from app.schemas.catalog import InventoryCreate, InventoryItem

router = APIRouter()


@router.get("", response_model=list[InventoryItem], summary="All inventory batches")
def list_inventory() -> list[dict]:
    return load_fixture("inventory")


@router.get("/{facility_id}", response_model=list[InventoryItem], summary="Facility inventory")
def get_facility_inventory(facility_id: str) -> list[dict]:
    rows = [r for r in load_fixture("inventory") if r["facility_id"] == facility_id]
    if not rows:
        raise HTTPException(status_code=404, detail=f"No inventory for {facility_id}")
    return rows


@router.post("", response_model=InventoryItem, summary="Record inventory (mock)")
def create_inventory(item: InventoryCreate) -> dict:
    stored = dict(item.model_dump())
    stored["id"] = "inv-new"
    stored["reserved_quantity"] = 0
    return stored
