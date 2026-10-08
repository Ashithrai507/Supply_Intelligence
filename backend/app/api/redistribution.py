"""Redistribution endpoints (project.md §13). Optimizer lands in issue #7."""

from fastapi import APIRouter, HTTPException

from app.api._fixtures import load_fixture
from app.schemas.redistribution import OptimizeRequest, OptimizeResponse, Recommendation

router = APIRouter()


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    summary="Run redistribution optimizer (mock)",
)
def optimize(request: OptimizeRequest) -> dict:
    _ = request  # scenario knob honoured by the real engine (issues #7 + #16)
    return load_fixture("optimize")


@router.get(
    "/recommendations", response_model=list[Recommendation], summary="Stored recommendations"
)
def list_recommendations() -> list[dict]:
    return load_fixture("recommendations")


@router.get(
    "/recommendations/{recommendation_id}",
    response_model=Recommendation,
    summary="Recommendation detail",
)
def get_recommendation(recommendation_id: str) -> dict:
    for rec in load_fixture("recommendations"):
        if rec["id"] == recommendation_id:
            return rec
    raise HTTPException(status_code=404, detail=f"Unknown recommendation {recommendation_id}")
