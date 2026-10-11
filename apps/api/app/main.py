from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_session
from app.operations import (
    case_detail,
    import_alert,
    login,
    open_case,
    principal_from_token,
    workspace,
)
from app.settings import settings

app = FastAPI(title="Subsea Response OS API")


class LoginBody(BaseModel):
    email: str
    password: str


def db_session() -> Session:
    yield from get_session()


def bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")
    return authorization.split(" ", 1)[1].strip()


@app.get("/health/live")
def health_live() -> dict:
    return {"status": "live"}


@app.get("/health/ready")
def health_ready(session: Session = Depends(db_session)) -> dict:
    try:
        session.execute(text("SELECT PostGIS_Version()"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="postgres unavailable") from exc
    try:
        import redis

        if not redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2).ping():
            raise RedisError("ping failed")
    except RedisError as exc:
        raise HTTPException(status_code=503, detail="redis unavailable") from exc
    try:
        response = httpx.get(f"{settings.s3_endpoint}/minio/health/live", timeout=2)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="storage unavailable") from exc
    return {"status": "ready", "postgres": "ok", "redis": "ok", "storage": "ok"}


@app.post("/auth/login")
def auth_login(body: LoginBody, session: Session = Depends(db_session)) -> dict:
    token, principal = login(session, body.email, body.password)
    return {
        "token": token,
        "role": principal.role,
        "organization_name": principal.organization_name,
        "fictional": True,
    }


@app.get("/auth/me")
def auth_me(
    session: Session = Depends(db_session),
    token: str = Depends(bearer_token),
) -> dict:
    principal = principal_from_token(session, token)
    return {
        "email": principal.email,
        "role": principal.role,
        "organization_name": principal.organization_name,
        "fictional": True,
    }


@app.get("/workspace")
def get_workspace(
    session: Session = Depends(db_session),
    token: str = Depends(bearer_token),
) -> dict:
    return workspace(session, principal_from_token(session, token))


@app.post("/alerts/import")
def post_import(
    session: Session = Depends(db_session),
    token: str = Depends(bearer_token),
) -> dict:
    return import_alert(session, principal_from_token(session, token))


@app.post("/cases")
def post_case(
    session: Session = Depends(db_session),
    token: str = Depends(bearer_token),
) -> dict:
    return open_case(session, principal_from_token(session, token))


@app.get("/cases/{case_id}")
def get_case(
    case_id: UUID,
    session: Session = Depends(db_session),
    token: str = Depends(bearer_token),
) -> dict:
    return case_detail(session, principal_from_token(session, token), case_id)
