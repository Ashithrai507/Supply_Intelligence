"""FastAPI application entrypoint.

Run locally:
    uv run uvicorn app.main:app --reload --app-dir backend
(or from backend/: ``uv run uvicorn app.main:app --reload``)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import api_router
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Supply Intelligence API v%s starting (%s)", __version__, settings.ENVIRONMENT)
    yield


def create_app() -> FastAPI:
    application = FastAPI(
        title="Supply Intelligence API",
        description=(
            "Medical Supply Early Warning & Redistribution Intelligence System. "
            "Contract: project.md §13 + PLAN.md §5 (frozen — changes need all four "
            "workstreams to agree, see WORKPLAN.md)."
        ),
        version=__version__,
        docs_url="/docs",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["http://localhost:5173"],
        # Vite bumps the dev-server port when 5173 is taken; in development accept
        # any loopback origin so the browser isn't blocked by a port mismatch.
        allow_origin_regex=(
            r"http://(localhost|127\.0\.0\.1)(:\d+)?" if settings.is_development else None
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(api_router)

    @application.get("/health", tags=["ops"], summary="Liveness probe (public)")
    def health() -> dict:
        return {"status": "ok", "version": __version__, "environment": settings.ENVIRONMENT}

    return application


app = create_app()
