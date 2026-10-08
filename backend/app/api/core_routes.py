"""PLAN.md §5 core/dashboard routes (no /v1 prefix — frozen contract issue #4).

These are the convenience paths the dashboard and every workstream curl against:
  GET  /api/state                         → dashboard state (KPIs, alerts, risk cards)
  GET  /api/network                       → nodes + edges for the map
  GET  /api/forecast/{facility}/{medicine}→ multi-horizon forecast bundle
  POST /api/redistribution/optimize       → alias of /api/v1/redistribution/optimize
  GET  /api/transfers/{id}/explain        → deterministic reason card (issue #12)
  POST /api/copilot                       → LLM copilot (issue #17)
"""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.assistant import CopilotRequest, CopilotResponse
from app.schemas.forecast import ForecastBundle
from app.schemas.redistribution import ExplainResponse, OptimizeRequest, OptimizeResponse
from app.schemas.state import NetworkResponse, StateResponse

router = APIRouter(prefix="/api")


@router.get("/state", response_model=StateResponse, summary="Dashboard state (PLAN.md §5)")
def get_state(scenario: str = "normal") -> dict:
    stored = dict(load_fixture("state"))
    stored["scenario"] = scenario if scenario in {
        "normal", "outbreak", "delay", "expiry_crisis", "competing", "combined"
    } else "normal"
    return stored


@router.get("/network", response_model=NetworkResponse, summary="Hospital network for map")
def get_network() -> dict:
    return load_fixture("network")


@router.get(
    "/forecast/{facility_id}/{medicine_id}",
    response_model=ForecastBundle,
    summary="Multi-horizon forecast bundle (7/14/30 days + quantiles)",
)
def get_forecast_bundle(facility_id: str, medicine_id: str) -> dict:
    stored = dict(load_fixture("forecast_bundle"))
    stored["facility_id"] = facility_id
    stored["medicine_id"] = medicine_id
    return stored


@router.post(
    "/redistribution/optimize",
    response_model=OptimizeResponse,
    summary="Optimize redistribution (PLAN.md §5 alias)",
)
def optimize_alias(request: OptimizeRequest) -> dict:
    _ = request
    return load_fixture("optimize")


@router.get(
    "/transfers/{transfer_id}/explain",
    response_model=ExplainResponse,
    summary="Deterministic WHY-THIS-ACTION card (no LLM)",
)
def explain_transfer(transfer_id: str) -> dict:
    stored = dict(load_fixture("transfer_explain"))
    stored["transfer_id"] = transfer_id
    return stored


@router.post("/copilot", response_model=CopilotResponse, summary="LLM operations copilot (mock)")
def copilot(body: CopilotRequest) -> dict:
    _ = body
    return load_fixture("copilot")
