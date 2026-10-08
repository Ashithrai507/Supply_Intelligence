"""Demand endpoints (project.md §13)."""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.catalog import DemandCreate, DemandPoint

router = APIRouter()


@router.get("", response_model=list[DemandPoint], summary="Recent demand history")
def list_demand() -> list[dict]:
    return load_fixture("demand")


@router.post("", response_model=DemandPoint, summary="Append demand record (mock)")
def create_demand(point: DemandCreate) -> dict:
    stored = dict(point.model_dump())
    stored["id"] = "dem-new"
    return stored
