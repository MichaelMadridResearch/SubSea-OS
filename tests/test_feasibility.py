import json

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app

client = TestClient(app)

_FORBIDDEN_TERMS = (
    "forecast",
    "probability",
    "dispatch",
    "shutdown",
    "wind",
    "wave",
    "current",
    "visibility",
)


def _login(email: str, password: str = "demo-only-not-a-secret") -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["token"]


def _table_counts(session) -> dict[str, int]:
    return {
        "audit_events": int(
            session.execute(text("SELECT count(*) FROM audit_events")).scalar_one()
        ),
        "evidence_events": int(
            session.execute(text("SELECT count(*) FROM evidence_events")).scalar_one()
        ),
        "response_cases": int(
            session.execute(text("SELECT count(*) FROM response_cases")).scalar_one()
        ),
    }


def test_workspace_read_exposes_fictional_feasibility(database) -> None:
    token = _login("operator@demo.invalid")
    session = SessionLocal()
    try:
        before = _table_counts(session)
    finally:
        session.close()

    response = client.get("/workspace", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()

    session = SessionLocal()
    try:
        after = _table_counts(session)
    finally:
        session.close()
    assert after == before

    feasibility = body["display"].get("feasibility")
    assert feasibility is not None
    assert feasibility["fictional"] is True
    assert feasibility["case_ref"] == "FICTIONAL-ALERT-001"
    assumption = feasibility["assumption"]
    assert isinstance(assumption, str)
    assert "Assumption:" in assumption

    serialized = json.dumps(feasibility).lower()
    for term in _FORBIDDEN_TERMS:
        assert term not in serialized
