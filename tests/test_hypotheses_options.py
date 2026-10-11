from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import SessionLocal
from app.main import app

client = TestClient(app)


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


def test_workspace_read_exposes_fictional_hypotheses_and_options(database) -> None:
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

    hypotheses = body["display"].get("hypotheses")
    options = body["display"].get("options")
    assert hypotheses is not None
    assert hypotheses["fictional"] is True
    assert hypotheses["case_ref"] == "FICTIONAL-ALERT-001"
    assert options is not None
    assert options["fictional"] is True
    assert options["case_ref"] == "FICTIONAL-ALERT-001"

    session = SessionLocal()
    try:
        cases_after = _table_counts(session)["response_cases"]
    finally:
        session.close()
    assert cases_after == before["response_cases"]
