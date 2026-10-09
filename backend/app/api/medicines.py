"""Medicine catalog API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_read
from app.models.entities import Medicine
from app.schemas.medpredict import MedicineSchema

router = APIRouter()


@router.get(
    "",
    response_model=list[MedicineSchema],
    summary="List all medicines",
    dependencies=[Depends(require_read)],
)
def list_medicines(db: Session = Depends(get_db)):
    meds = db.query(Medicine).all()
    return [
        MedicineSchema(
            id=str(m.id),
            name=m.name,
            category=m.category,
            unit=m.unit,
            criticality_level=m.criticality_level,
        )
        for m in meds
    ]


@router.get(
    "/{medicine_id}",
    response_model=MedicineSchema,
    summary="Get medicine by ID",
    dependencies=[Depends(require_read)],
)
def get_medicine(medicine_id: str, db: Session = Depends(get_db)):
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    return MedicineSchema(
        id=str(med.id),
        name=med.name,
        category=med.category,
        unit=med.unit,
        criticality_level=med.criticality_level,
    )
