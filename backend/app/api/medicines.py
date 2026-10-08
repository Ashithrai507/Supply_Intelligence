"""Medicine catalog endpoints (supporting route; §10 medicines module)."""

from fastapi import APIRouter, Depends

from app.api._fixtures import load_fixture
from app.core.security import require_read
from app.schemas.catalog import Medicine

router = APIRouter()


@router.get(
    "",
    response_model=list[Medicine],
    summary="List medicines",
    dependencies=[Depends(require_read)],
)
def list_medicines() -> list[dict]:
    return load_fixture("medicines")
