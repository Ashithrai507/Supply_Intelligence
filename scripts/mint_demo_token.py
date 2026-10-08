"""Mint a demo Supabase-style JWT for local curl testing (issue #8 acceptance).

The token is HS256-signed with SUPABASE_JWT_SECRET and carries the same
app_metadata claims the auth.users trigger stamps (role + facility_id).

Usage:
    export SUPABASE_JWT_SECRET=<secret from supabase status>
    uv run python scripts/mint_demo_token.py --role ADMIN
    curl -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/state
"""

import argparse
import os
import sys
import time
import uuid

import jwt

ROLES = ("ADMIN", "FACILITY_MANAGER", "ANALYST")


def mint_token(secret: str, role: str, facility_id: str | None, ttl_hours: int) -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": f"{role.lower()}@demo.local",
            "aud": "authenticated",
            "iat": now,
            "exp": now + ttl_hours * 3600,
            "app_metadata": {
                "role": role,
                "facility_id": facility_id,
            },
        },
        secret,
        algorithm="HS256",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Mint a demo JWT for local testing")
    parser.add_argument("--role", choices=ROLES, default="ADMIN")
    parser.add_argument("--facility-id", default="00000000-0000-0000-0000-00000000fac1")
    parser.add_argument("--ttl-hours", type=int, default=8)
    args = parser.parse_args()

    secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    if not secret:
        print("error: SUPABASE_JWT_SECRET is not set", file=sys.stderr)
        return 1
    facility_id = args.facility_id if args.role == "FACILITY_MANAGER" else None
    print(mint_token(secret, args.role, facility_id, args.ttl_hours))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
