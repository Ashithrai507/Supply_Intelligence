"""Supabase JWT verification + RBAC (project.md §4, §32). Issue #8.

Supabase Auth signs JWTs with HS256 using ``SUPABASE_JWT_SECRET`` (legacy
symmetric path). The token carries the caller's identity plus the role claims
that the ``auth.users`` trigger stamps into ``app_metadata``
(``supabase/migrations/20261008090200_profiles_trigger.sql``):

    app_metadata: {"role": "ADMIN" | "FACILITY_MANAGER" | "ANALYST",
                   "facility_id": "<uuid>" | null}

FastAPI verifies the signature, builds a :class:`CurrentUser`, and enforces
the role model per project.md §4:

* ``ADMIN``            → everything, including runs/writes
* ``FACILITY_MANAGER`` → reads (facility scoping enforced by RLS + services)
* ``ANALYST``          → reads (network-wide analytics)

Usage on a route::

    @router.get("/x", dependencies=[Depends(require_read)])
    @router.post("/run", dependencies=[Depends(require_admin)])
"""

import logging
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger("app.security")

ROLE_ADMIN = "ADMIN"
ROLE_FACILITY_MANAGER = "FACILITY_MANAGER"
ROLE_ANALYST = "ANALYST"
ALL_ROLES = (ROLE_ADMIN, ROLE_FACILITY_MANAGER, ROLE_ANALYST)

#: Reads are open to every authenticated role (§4: everyone views/inspects).
READ_ROLES = ALL_ROLES
#: Writes/runs (forecast runs, optimization, scenarios, record creation) are
#: ADMIN-only in the MVP — §4 grants run powers to Administrator only.
WRITE_ROLES = (ROLE_ADMIN,)

bearer_scheme = HTTPBearer(
    auto_error=False,
    description="Supabase JWT: Authorization: Bearer <supabase-jwt> (project.md §32)",
)


class CurrentUser(BaseModel):
    """Caller identity extracted from a verified Supabase JWT."""

    user_id: str
    email: str | None = None
    role: str
    facility_id: str | None = None


def jwt_secret_configured() -> bool:
    """True once SUPABASE_JWT_SECRET is present."""
    return bool(settings.SUPABASE_JWT_SECRET)


def verify_token(token: str) -> dict:
    """Verify a Supabase-issued JWT and return its claims.

    Raises:
        HTTPException: 401 when the secret is missing, the token is expired,
            or the signature/claims are invalid.
    """
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Auth is not configured (SUPABASE_JWT_SECRET missing)",
        )
    try:
        claims: dict = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}"
        ) from exc
    return claims


def user_from_claims(claims: dict) -> CurrentUser:
    """Build a :class:`CurrentUser` from verified JWT claims (401 on bad claims)."""
    app_metadata = claims.get("app_metadata") or {}
    role = app_metadata.get("role") or claims.get("role")
    facility_id = app_metadata.get("facility_id") or claims.get("facility_id")
    if role not in ALL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unknown or missing role claim: {role!r}",
        )
    return CurrentUser(
        user_id=str(claims.get("sub")),
        email=claims.get("email"),
        role=role,
        facility_id=str(facility_id) if facility_id else None,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    """FastAPI dependency: verified caller or 401 (missing/invalid/expired)."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated: missing Bearer token",
        )
    return user_from_claims(verify_token(credentials.credentials))


def require_roles(*allowed: str) -> Callable:
    """Dependency factory: 403 unless the caller's role is in ``allowed``."""

    async def _check(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role} is not allowed here (needs one of {list(allowed)})",
            )
        return user

    return _check


#: Ready-made dependencies: ``dependencies=[Depends(require_read)]`` on GETs,
#: ``dependencies=[Depends(require_admin)]`` on POSTs/runs.
require_read = require_roles(*READ_ROLES)
require_admin = require_roles(*WRITE_ROLES)
