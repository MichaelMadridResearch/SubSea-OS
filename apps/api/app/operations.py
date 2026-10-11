import json
import secrets
import uuid
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.mapping import NotAVertexError, require_vertex
from app.models import (
    Alert,
    AuditEvent,
    EvidenceEvent,
    ExportCable,
    ResponseCase,
    Route,
    WindFarm,
)
from app.models import (
    Session as SessionRow,
)
from app.passwords import hash_token, verify_password
from app.response_rules import build_response
from app.seed import load_fixtures


@dataclass
class Principal:
    user_id: uuid.UUID
    organization_id: uuid.UUID
    email: str
    role: str
    organization_name: str


def login(session: Session, email: str, password: str) -> tuple[str, Principal]:
    row = session.execute(
        text(
            """
            SELECT u.id, u.organization_id, u.email, u.password_hash, u.role, o.name
            FROM users u
            JOIN organizations o ON o.id = u.organization_id
            WHERE u.email = :email
            """
        ),
        {"email": email},
    ).one_or_none()
    if row is None or not verify_password(password, row.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = secrets.token_urlsafe(32)
    session.add(SessionRow(token_hash=hash_token(token), user_id=row.id))
    session.commit()
    principal = Principal(row.id, row.organization_id, row.email, row.role, row.name)
    return token, principal


def principal_from_token(session: Session, token: str) -> Principal:
    row = session.execute(
        text(
            """
            SELECT u.id, u.organization_id, u.email, u.role, o.name
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            JOIN organizations o ON o.id = u.organization_id
            WHERE s.token_hash = :token_hash
            """
        ),
        {"token_hash": hash_token(token)},
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return Principal(row.id, row.organization_id, row.email, row.role, row.name)


def _require_operator(principal: Principal) -> None:
    if principal.role != "operator":
        raise HTTPException(status_code=403, detail="Operator approval is required.")


def route_coordinates(session: Session, organization_id: uuid.UUID) -> list[list[float]]:
    geojson = session.execute(
        text(
            """
            SELECT ST_AsGeoJSON(geom)
            FROM routes
            WHERE organization_id = :organization_id
            """
        ),
        {"organization_id": organization_id},
    ).scalar_one()
    return json.loads(geojson)["coordinates"]


def workspace(session: Session, principal: Principal) -> dict:
    farm = session.scalar(
        select(WindFarm).where(WindFarm.organization_id == principal.organization_id)
    )
    cable = session.scalar(
        select(ExportCable).where(ExportCable.organization_id == principal.organization_id)
    )
    route = session.scalar(select(Route).where(Route.organization_id == principal.organization_id))
    alert = session.scalar(select(Alert).where(Alert.organization_id == principal.organization_id))
    case = None
    if alert is not None:
        case = session.scalar(
            select(ResponseCase).where(
                ResponseCase.organization_id == principal.organization_id,
                ResponseCase.alert_id == alert.id,
            )
        )
    coordinates = route_coordinates(session, principal.organization_id)
    fixtures = load_fixtures()
    display = fixtures["display"]
    return {
        "fictional": True,
        "organization_name": principal.organization_name,
        "wind_farm_name": farm.name if farm else "",
        "cable_name": cable.name if cable else "",
        "route": {
            "name": route.name if route else "",
            "type": "LineString",
            "coordinates": coordinates,
        },
        "alert": None
        if alert is None
        else {
            "id": str(alert.id),
            "external_ref": alert.external_ref,
            "summary": alert.summary,
            "route_vertex": alert.route_vertex,
        },
        "case": None if case is None else {"id": str(case.id), "state": case.state},
        "display": display,
        "response": build_response(fixtures),
    }


def import_alert(session: Session, principal: Principal) -> dict:
    _require_operator(principal)
    fixtures = load_fixtures()
    alert_json = fixtures["alert"]
    existing = session.scalar(
        select(Alert).where(
            Alert.organization_id == principal.organization_id,
            Alert.external_ref == alert_json["external_ref"],
        )
    )
    if existing is not None:
        return {
            "id": str(existing.id),
            "external_ref": existing.external_ref,
            "summary": existing.summary,
            "route_vertex": existing.route_vertex,
        }
    cable = session.scalar(
        select(ExportCable).where(ExportCable.organization_id == principal.organization_id)
    )
    if cable is None:
        raise HTTPException(status_code=404, detail="No export cable is seeded.")
    coordinates = route_coordinates(session, principal.organization_id)
    point = (float(alert_json["location"][0]), float(alert_json["location"][1]))
    line = [(float(lon), float(lat)) for lon, lat in coordinates]
    try:
        vertex = require_vertex(point, line)
    except NotAVertexError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    alert_id = uuid.uuid4()
    session.execute(
        text(
            """
            INSERT INTO alerts (
              id, organization_id, export_cable_id, external_ref, summary,
              location, route_vertex, is_fictional
            )
            VALUES (
              :id, :organization_id, :export_cable_id, :external_ref, :summary,
              ST_GeomFromText(:wkt, 4326), :route_vertex, true
            )
            """
        ),
        {
            "id": alert_id,
            "organization_id": principal.organization_id,
            "export_cable_id": cable.id,
            "external_ref": alert_json["external_ref"],
            "summary": alert_json["summary"],
            "wkt": f"POINT({point[0]} {point[1]})",
            "route_vertex": vertex,
        },
    )
    session.add(
        AuditEvent(
            id=uuid.uuid4(),
            organization_id=principal.organization_id,
            actor_id=principal.user_id,
            action="alert_imported",
            subject_type="alert",
            subject_id=alert_id,
            snapshot={
                "fictional": True,
                "external_ref": alert_json["external_ref"],
                "route_vertex": vertex,
                "assumption": "Exact vertex equality. No proximity threshold.",
            },
        )
    )
    session.commit()
    return {
        "id": str(alert_id),
        "external_ref": alert_json["external_ref"],
        "summary": alert_json["summary"],
        "route_vertex": vertex,
    }


def open_case(session: Session, principal: Principal) -> dict:
    _require_operator(principal)
    alert = session.scalar(select(Alert).where(Alert.organization_id == principal.organization_id))
    if alert is None:
        raise HTTPException(status_code=404, detail="Import the alert first.")
    existing = session.scalar(
        select(ResponseCase).where(
            ResponseCase.organization_id == principal.organization_id,
            ResponseCase.alert_id == alert.id,
        )
    )
    if existing is not None:
        return case_detail(session, principal, existing.id)
    case = ResponseCase(
        id=uuid.uuid4(),
        organization_id=principal.organization_id,
        alert_id=alert.id,
        export_cable_id=alert.export_cable_id,
        state="open",
        opened_by=principal.user_id,
        is_fictional=True,
    )
    session.add(case)
    session.flush()
    events = [
        EvidenceEvent(
            id=uuid.uuid4(),
            organization_id=principal.organization_id,
            case_id=case.id,
            kind="alert_imported",
            summary=(
                f"Alert {alert.external_ref} was imported from the Harbor Light sensor window."
            ),
        ),
        EvidenceEvent(
            id=uuid.uuid4(),
            organization_id=principal.organization_id,
            case_id=case.id,
            kind="location_mapped",
            summary=(
                "Alert location is a vertex of the stored route. "
                "No proximity threshold was applied."
            ),
        ),
        EvidenceEvent(
            id=uuid.uuid4(),
            organization_id=principal.organization_id,
            case_id=case.id,
            kind="case_opened",
            summary=(
                "An operator opened an advisory response case. "
                "No shutdown or dispatch was performed."
            ),
        ),
    ]
    session.add_all(events)
    session.add(
        AuditEvent(
            id=uuid.uuid4(),
            organization_id=principal.organization_id,
            actor_id=principal.user_id,
            action="case_opened",
            subject_type="response_case",
            subject_id=case.id,
            snapshot={
                "fictional": True,
                "alert_external_ref": alert.external_ref,
                "route_vertex": alert.route_vertex,
                "state": "open",
                "assumption": "Human approval via POST /cases. No equipment was commanded.",
            },
        )
    )
    session.commit()
    return case_detail(session, principal, case.id)


def case_detail(session: Session, principal: Principal, case_id: uuid.UUID) -> dict:
    case = session.scalar(
        select(ResponseCase).where(
            ResponseCase.id == case_id,
            ResponseCase.organization_id == principal.organization_id,
        )
    )
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found.")
    events = session.scalars(
        select(EvidenceEvent)
        .where(
            EvidenceEvent.case_id == case.id,
            EvidenceEvent.organization_id == principal.organization_id,
        )
        .order_by(EvidenceEvent.created_at, EvidenceEvent.id)
    ).all()
    return {
        "id": str(case.id),
        "state": case.state,
        "fictional": True,
        "timeline": [
            {"id": str(event.id), "kind": event.kind, "summary": event.summary} for event in events
        ],
    }
