"""Facility endpoints (project.md §13)."""

from fastapi import APIRouter, Depends, HTTPException

from app.api._fixtures import load_fixture
from app.core.security import require_admin, require_read
from app.schemas.catalog import Facility

router = APIRouter()


@router.get(
    "",
    response_model=list[Facility],
    summary="List facilities",
    dependencies=[Depends(require_read)],
)
def list_facilities() -> list[dict]:
    return load_fixture("facilities")


@router.get(
    "/{facility_id}",
    response_model=Facility,
    summary="Facility detail",
    dependencies=[Depends(require_read)],
)
def get_facility(facility_id: str) -> dict:
    for facility in load_fixture("facilities"):
        if facility["id"] == facility_id:
            return facility
    raise HTTPException(status_code=404, detail=f"Unknown facility {facility_id}")


@router.post(
    "",
    response_model=Facility,
    status_code=201,
    summary="Create facility (mock)",
    dependencies=[Depends(require_admin)],
)
def create_facility(facility: Facility) -> dict:
    return facility.model_dump()
