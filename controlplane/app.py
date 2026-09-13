"""AgentOS Control Plane application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from controlplane.api import router
from controlplane.db import Base, engine
from controlplane.settings import settings


def _ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    # Lightweight SQLite column add for evolving MVP schema (no Alembic yet)
    insp = inspect(engine)
    if "capability_grants" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("capability_grants")}
        if "revoked_at" not in cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE capability_grants ADD COLUMN revoked_at DATETIME"))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _ensure_schema()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentos-control-plane"}
