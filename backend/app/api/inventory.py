"""Inventory API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.medpredict import MedicineInventoryDetail
from app.services.inventory_service import (
    calculate_medicine_inventory,
    list_hospital_inventory,
)

router = APIRouter()


@router.get("", response_model=list[MedicineInventoryDetail], summary="List inventory for hospital")
def get_inventory(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    return list_hospital_inventory(db, hospital_id, surge_multiplier)


@router.get("/{hospital_id}/{medicine_id}", response_model=MedicineInventoryDetail, summary="Get medicine inventory details")
def get_medicine_inventory(
    hospital_id: str,
    medicine_id: str,
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    detail = calculate_medicine_inventory(db, hospital_id, medicine_id, surge_multiplier)
    if not detail:
        raise HTTPException(status_code=404, detail="Medicine or hospital not found")
    return detail
