"""Auth endpoints (project.md §13). JWT enforcement lands in issue #8."""

from fastapi import APIRouter

from app.api._fixtures import load_fixture
from app.schemas.catalog import MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse, summary="Current caller identity")
def get_me() -> dict:
    return load_fixture("me")
