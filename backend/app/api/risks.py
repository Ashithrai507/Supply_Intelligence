"""Risk and alerts API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_read
from app.schemas.medpredict import ExpiryRiskItem, StockoutRiskItem
from app.services.risk_service import get_expiry_risks, get_stockout_risks

router = APIRouter()


@router.get(
    "/stockout",
    response_model=list[StockoutRiskItem],
    summary="Get stock-out risks",
    dependencies=[Depends(require_read)],
)
def list_stockout_risks(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    return get_stockout_risks(db, hospital_id, surge_multiplier)


@router.get(
    "/expiry",
    response_model=list[ExpiryRiskItem],
    summary="Get expiry and wastage risks",
    dependencies=[Depends(require_read)],
)
def list_expiry_risks(
    hospital_id: str = Query(default="H01", description="Hospital ID"),
    surge_multiplier: float = Query(default=1.0, description="Optional demand surge multiplier"),
    db: Session = Depends(get_db),
):
    return get_expiry_risks(db, hospital_id, surge_multiplier)
