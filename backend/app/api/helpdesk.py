"""MedPredict Helpdesk API — grounded Gemini assistant (POST /helpdesk/query).

Gemini is only ever reached through this endpoint; the frontend never holds a
Gemini key. Scope (hospital) is resolved on the backend.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import HelpdeskScope, get_helpdesk_scope
from app.schemas.helpdesk import (
    HelpdeskCapability,
    HelpdeskRequest,
    HelpdeskResponse,
)
from app.services.helpdesk_service import (
    HelpdeskBadResponseError,
    HelpdeskUnavailableError,
    answer_question,
    get_capabilities,
)

router = APIRouter(tags=["helpdesk"])


@router.post("/query", response_model=HelpdeskResponse)
def helpdesk_query(
    request: HelpdeskRequest,
    scope: HelpdeskScope = Depends(get_helpdesk_scope),
    db: Session = Depends(get_db),
) -> HelpdeskResponse:
    """Answer a grounded question about the caller's hospital MedPredict data."""
    try:
        return answer_question(db, scope, request)
    except HelpdeskUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Helpdesk temporarily unavailable",
        ) from None
    except HelpdeskBadResponseError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Helpdesk could not complete the request",
        ) from None


@router.get("/capabilities", response_model=list[HelpdeskCapability])
def helpdesk_capabilities(
    scope: HelpdeskScope = Depends(get_helpdesk_scope),
) -> list[HelpdeskCapability]:
    """List what the Helpdesk can answer (for the chat starter chips)."""
    return get_capabilities()