"""Demand spike / what-if simulation API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.medpredict import SimulationComparison, SimulationRequest
from app.services.simulation_service import run_demand_simulation

router = APIRouter()


@router.post("/run", response_model=SimulationComparison, summary="Run demand surge what-if simulation")
def run_simulation(
    req: SimulationRequest,
    db: Session = Depends(get_db),
):
    comparison = run_demand_simulation(
        db=db,
        hospital_id=req.hospital_id,
        medicine_id=req.medicine_id,
        demand_increase_pct=req.demand_increase_pct,
    )
    if not comparison:
        raise HTTPException(status_code=404, detail="Hospital or medicine not found")
    return comparison
