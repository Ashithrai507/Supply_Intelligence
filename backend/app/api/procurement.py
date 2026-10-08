"""Procurement and recommendations API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.medpredict import ProcurementRecommendation, SimpleRedistribution
from app.services.procurement_service import (
    generate_procurement_recommendations,
    generate_redistribution_suggestions,
)

router = APIRouter()


@router.get("/recommendations", response_model=list[ProcurementRecommendation], summary="Get procurement recommendations")
def get_recommendations(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    return generate_procurement_recommendations(db, hospital_id, surge_multiplier)


@router.get("/redistribution", response_model=list[SimpleRedistribution], summary="Get simple redistribution suggestions")
def get_redistributions(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    db: Session = Depends(get_db),
):
    return generate_redistribution_suggestions(db, hospital_id)
