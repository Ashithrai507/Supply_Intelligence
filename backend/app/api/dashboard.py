"""Hospital dashboard API endpoint."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.medpredict import DashboardResponse
from app.services.dashboard_service import get_hospital_dashboard

router = APIRouter()


@router.get("", response_model=DashboardResponse, summary="Get complete hospital operations dashboard")
def get_dashboard(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    dashboard = get_hospital_dashboard(db, hospital_id, surge_multiplier)
    if not dashboard:
        raise HTTPException(status_code=404, detail="Hospital dashboard not found")
    return dashboard
