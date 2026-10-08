"""API routers (project.md §10 — this package is the "routers/" of the skeleton).

Every router returns contract-shaped payloads validated by ``app.schemas``.
Mock data is served from ``tests/fixtures/`` until the real pipeline lands
(see WORKPLAN.md build order).
"""

from fastapi import APIRouter

from app.api import (
    assistant,
    auth,
    core_routes,
    demand,
    facilities,
    forecasts,
    inventory,
    medicines,
    redistribution,
    risks,
    scenarios,
)

#: Mounted under /api/v1 (project.md §13 — canonical contract paths).
api_v1_router = APIRouter()
api_v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(facilities.router, prefix="/facilities", tags=["facilities"])
api_v1_router.include_router(medicines.router, prefix="/medicines", tags=["medicines"])
api_v1_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_v1_router.include_router(demand.router, prefix="/demand", tags=["demand"])
api_v1_router.include_router(forecasts.router, prefix="/forecasts", tags=["forecasting"])
api_v1_router.include_router(risks.router, prefix="/risks", tags=["risk"])
api_v1_router.include_router(
    redistribution.router, prefix="/redistribution", tags=["redistribution"]
)
api_v1_router.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
api_v1_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])

#: PLAN.md §5 convenience/core routes (dashboard-oriented, no /v1 prefix).
api_router = APIRouter()
api_router.include_router(api_v1_router, prefix="/api/v1")
api_router.include_router(core_routes.router, tags=["core"])
