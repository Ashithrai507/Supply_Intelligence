"""Hospital API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_read
from app.models.entities import Hospital
from app.schemas.medpredict import HospitalSchema

router = APIRouter()


@router.get(
    "",
    response_model=list[HospitalSchema],
    summary="List all hospitals",
    dependencies=[Depends(require_read)],
)
def list_hospitals(db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).all()
    return [
        HospitalSchema(
            id=str(h.id),
            name=h.name,
            city=h.city,
            bed_capacity=h.bed_capacity,
            avg_daily_patients=h.avg_daily_patients,
        )
        for h in hospitals
    ]


@router.get(
    "/{hospital_id}",
    response_model=HospitalSchema,
    summary="Get hospital by ID",
    dependencies=[Depends(require_read)],
)
def get_hospital(hospital_id: str, db: Session = Depends(get_db)):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return HospitalSchema(
        id=str(hospital.id),
        name=hospital.name,
        city=hospital.city,
        bed_capacity=hospital.bed_capacity,
        avg_daily_patients=hospital.avg_daily_patients,
    )
