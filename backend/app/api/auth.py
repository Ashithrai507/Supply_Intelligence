"""Auth endpoints (project.md §13). JWT enforcement: issue #8."""

from fastapi import APIRouter, Depends

from app.core.security import CurrentUser, get_current_user
from app.schemas.catalog import MeResponse

router = APIRouter()


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Current caller identity",
    dependencies=[Depends(get_current_user)],
)
def get_me(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {
        "user_id": user.user_id,
        "email": user.email or "",
        "role": user.role,
        "facility_id": user.facility_id,
    }
