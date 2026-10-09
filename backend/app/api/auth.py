"""Auth endpoints (project.md §13). JWT enforcement: issue #8."""

import hashlib
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, create_access_token, get_current_user
from app.models.entities import Hospital
from app.schemas.catalog import MeResponse

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    user: dict[str, Any]


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate hospital user and return Supabase-signed JWT",
)
def login(req: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    identifier = req.email.strip().lower()
    password = req.password.strip()

    if not identifier or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email/hospital identifier and password are required",
        )

    # 1. Admin login credentials
    if identifier in {"admin@medipulse.health", "admin@demo.local", "admin"}:
        if password not in {"admin123!", "supplyPass2026!", "admin"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials for administrator account",
            )
        token = create_access_token(
            user_id="00000000-0000-0000-0000-000000000000",
            email="admin@medipulse.health",
            role="ADMIN",
            facility_id=None,
        )
        return LoginResponse(
            access_token=token,
            expires_in=86400,
            user={
                "id": "00000000-0000-0000-0000-000000000000",
                "email": "admin@medipulse.health",
                "name": "System Administrator",
                "role": "ADMIN",
                "facility_id": None,
                "hospital_name": "Network Command Center",
            },
        )

    # 2. Hospital / Facility Manager login
    # Matches by ID (e.g. "H01"), email pattern (e.g. "hospital-a@medipulse.health"), or name
    hospitals = db.query(Hospital).all()
    matched_hospital: Hospital | None = None
    for h in hospitals:
        slug = h.name.lower().replace(" ", "-")
        expected_email = f"{slug}@medipulse.health"
        code_email = f"{h.id.lower()}@medipulse.health"
        if (
            identifier == h.id.lower()
            or identifier == expected_email
            or identifier == code_email
            or identifier == h.name.lower()
        ):
            matched_hospital = h
            break

    if not matched_hospital:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hospital account not found with the provided credentials",
        )

    # Standard clinical password validation for local/demo deployment
    # Accepts common preset demo password or 'hospital123!' or 'supplyPass2026!'
    valid_passwords = {"supplyPass2026!", "hospital123!", "medipulse2026!", "password"}
    if password not in valid_passwords:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password for hospital account",
        )

    # Generate a deterministic user UUID from hospital ID
    user_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"user.{matched_hospital.id}"))
    slug = matched_hospital.name.lower().replace(" ", "-")
    user_email = f"{slug}@medipulse.health"

    token = create_access_token(
        user_id=user_uuid,
        email=user_email,
        role="FACILITY_MANAGER",
        facility_id=str(matched_hospital.id),
    )

    return LoginResponse(
        access_token=token,
        expires_in=86400,
        user={
            "id": user_uuid,
            "email": user_email,
            "name": f"Director of Pharmacy — {matched_hospital.name}",
            "role": "FACILITY_MANAGER",
            "facility_id": str(matched_hospital.id),
            "hospital_name": matched_hospital.name,
            "city": matched_hospital.city,
            "bed_capacity": matched_hospital.bed_capacity,
        },
    )


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

