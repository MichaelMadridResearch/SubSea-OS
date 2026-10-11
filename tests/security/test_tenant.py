import uuid
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db import SessionLocal
from app.main import app
from app.passwords import hash_password

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]


def test_openapi_paths_exist() -> None:
    spec = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="utf-8"))
    live = {getattr(route, "path", None) for route in app.routes}
    for path in spec["paths"]:
        assert path in live


def test_live_health() -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "live"


def test_logged_out_sign_in_required() -> None:
    missing = client.get("/workspace")
    assert missing.status_code == 401
    assert missing.json()["detail"] == "Sign in required."
    opened = client.post("/cases")
    assert opened.status_code == 401
    assert opened.json()["detail"] == "Sign in required."
    hidden = client.get("/cases/00000000-0000-0000-0000-000000000001")
    assert hidden.status_code == 401
    assert hidden.json()["detail"] == "Sign in required."


def test_unknown_token_sign_in_required(database) -> None:
    response = client.get("/workspace", headers={"Authorization": "Bearer not-a-session"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Sign in required."


def _login(email: str, password: str = "demo-only-not-a-secret") -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["token"]


def test_golden_path_tenant_and_audit(database) -> None:
    token = _login("operator@demo.invalid")
    imported = client.post("/alerts/import", headers={"Authorization": f"Bearer {token}"})
    assert imported.status_code == 200
    again = client.post(
        "/alerts/import",
        headers={"Authorization": f"Bearer {token}"},
        json={"location": [0, 0], "summary": "real incident"},
    )
    assert again.status_code == 200
    assert again.json()["id"] == imported.json()["id"]
    assert again.json()["external_ref"] == "FICTIONAL-ALERT-001"

    opened = client.post("/cases", headers={"Authorization": f"Bearer {token}"})
    assert opened.status_code == 200
    body = opened.json()
    assert body["state"] == "open"
    summaries = [item["summary"] for item in body["timeline"]]
    assert any("No proximity threshold was applied." in item for item in summaries)
    assert any("No shutdown or dispatch was performed." in item for item in summaries)

    session = SessionLocal()
    try:
        for statement in (
            "UPDATE audit_events SET action = 'tampered'",
            "DELETE FROM audit_events",
            "UPDATE evidence_events SET summary = 'tampered'",
            "DELETE FROM evidence_events",
        ):
            with pytest.raises(DBAPIError) as caught:
                session.execute(text(statement))
                session.commit()
            assert "append-only table" in str(caught.value)
            session.rollback()
        with pytest.raises(DBAPIError) as caught:
            session.execute(
                text(
                    """
                    INSERT INTO organizations (id, name, is_fictional)
                    VALUES (:id, :name, false)
                    """
                ),
                {"id": uuid.uuid4(), "name": "Not fictional"},
            )
            session.commit()
        assert "organizations_fictional" in str(caught.value)
        session.rollback()
    finally:
        session.close()

    viewer_id = uuid.uuid4()
    other_org = uuid.uuid4()
    other_user = uuid.uuid4()
    session = SessionLocal()
    try:
        org_id = session.execute(text("SELECT organization_id FROM users LIMIT 1")).scalar_one()
        session.execute(
            text(
                """
                INSERT INTO users (id, organization_id, email, password_hash, role, is_fictional)
                VALUES (:id, :organization_id, :email, :password_hash, 'viewer', true)
                """
            ),
            {
                "id": viewer_id,
                "organization_id": org_id,
                "email": "viewer@demo.invalid",
                "password_hash": hash_password("demo-only-not-a-secret"),
            },
        )
        session.execute(
            text("INSERT INTO organizations (id, name, is_fictional) VALUES (:id, :name, true)"),
            {"id": other_org, "name": "Fictional Other Tenant"},
        )
        session.execute(
            text(
                """
                INSERT INTO users (id, organization_id, email, password_hash, role, is_fictional)
                VALUES (:id, :organization_id, :email, :password_hash, 'operator', true)
                """
            ),
            {
                "id": other_user,
                "organization_id": other_org,
                "email": "other@demo.invalid",
                "password_hash": hash_password("demo-only-not-a-secret"),
            },
        )
        session.commit()
    finally:
        session.close()

    viewer = _login("viewer@demo.invalid")
    forbidden_import = client.post("/alerts/import", headers={"Authorization": f"Bearer {viewer}"})
    assert forbidden_import.status_code == 403
    assert forbidden_import.json()["detail"] == "Operator approval is required."
    forbidden = client.post("/cases", headers={"Authorization": f"Bearer {viewer}"})
    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "Operator approval is required."

    other = _login("other@demo.invalid")
    hidden = client.get(
        f"/cases/{body['id']}",
        headers={"Authorization": f"Bearer {other}"},
    )
    assert hidden.status_code == 404
    assert hidden.json()["detail"] == "Case not found."
