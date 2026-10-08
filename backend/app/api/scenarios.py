"""Scenario endpoints (project.md §13, §25). Engine lands in issue #16."""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.scenario import ScenarioCreate, ScenarioResponse, ScenarioRunResponse

router = APIRouter()


@router.post("", response_model=ScenarioResponse, status_code=201, summary="Create scenario (mock)")
def create_scenario(body: ScenarioCreate) -> dict:
    stored = dict(load_fixture("scenarios"))
    stored["name"] = body.name
    stored["scenario"] = body.scenario
    stored["knobs"] = body.knobs
    return stored


@router.get("/{scenario_id}", response_model=ScenarioResponse, summary="Scenario detail")
def get_scenario(scenario_id: str) -> dict:
    stored = dict(load_fixture("scenarios"))
    stored["id"] = scenario_id
    return stored


@router.post(
    "/{scenario_id}/run",
    response_model=ScenarioRunResponse,
    summary="Run scenario (mock — before/after KPIs)",
)
def run_scenario(scenario_id: str) -> dict:
    stored = dict(load_fixture("scenario_run"))
    stored["id"] = scenario_id
    return stored
