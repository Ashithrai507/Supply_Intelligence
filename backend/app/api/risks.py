"""Risk endpoints: stock-out + expiry (project.md §13; engines from #14/#15)."""

from fastapi import APIRouter, Depends

from app.api._fixtures import load_fixture
from app.core.security import require_read
from app.schemas.risk import ExpiryRiskCard, StockoutRiskCard

router = APIRouter()


@router.get(
    "/stockout",
    response_model=list[StockoutRiskCard],
    summary="Stock-out risk cards",
    dependencies=[Depends(require_read)],
)
def list_stockout_risks() -> list[dict]:
    return load_fixture("risks_stockout")


@router.get(
    "/expiry",
    response_model=list[ExpiryRiskCard],
    summary="Expiry risk cards",
    dependencies=[Depends(require_read)],
)
def list_expiry_risks() -> list[dict]:
    return load_fixture("risks_expiry")
