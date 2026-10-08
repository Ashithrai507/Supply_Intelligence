"""Supabase JWT verification + RBAC (project.md §32).

IMPLEMENTED IN ISSUE #8 — this module is the agreed seam:

* ``verify_token``      → decode/verify Supabase-issued JWTs (SUPABASE_JWT_SECRET)
* ``get_current_user``  → FastAPI dependency returning the caller's identity + role
* ``require_roles``     → FastAPI dependency factory for role gating

Roles (project.md §4 / §12): ``ADMIN`` | ``FACILITY_MANAGER`` | ``ANALYST``.

Auth is NOT enforced yet (issue #4 contract endpoints are open so
``curl /api/state`` works for every workstream). Issue #8 closes that door.
"""

from app.core.config import settings

ROLE_ADMIN = "ADMIN"
ROLE_FACILITY_MANAGER = "FACILITY_MANAGER"
ROLE_ANALYST = "ANALYST"
ALL_ROLES = (ROLE_ADMIN, ROLE_FACILITY_MANAGER, ROLE_ANALYST)


def jwt_secret_configured() -> bool:
    """True once SUPABASE_JWT_SECRET is present (issue #8 requires this)."""
    return bool(settings.SUPABASE_JWT_SECRET)
