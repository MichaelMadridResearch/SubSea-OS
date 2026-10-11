import json
import uuid
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import ExportCable, Organization, User, WindFarm
from app.passwords import hash_password
from app.settings import settings


def load_fixtures(directory: Path | None = None) -> dict:
    root = directory or Path(settings.demo_data_dir)
    return {
        "catalog": json.loads((root / "catalog.json").read_text(encoding="utf-8")),
        "route": json.loads((root / "route.json").read_text(encoding="utf-8")),
        "alert": json.loads((root / "alert.json").read_text(encoding="utf-8")),
        "display": json.loads((root / "display.json").read_text(encoding="utf-8")),
        "response": json.loads((root / "response.json").read_text(encoding="utf-8")),
    }


def linestring_wkt(coordinates: list[list[float]]) -> str:
    pairs = ", ".join(f"{lon} {lat}" for lon, lat in coordinates)
    return f"LINESTRING({pairs})"


def reset_and_seed(session: Session, directory: Path | None = None) -> None:
    fixtures = load_fixtures(directory)
    catalog = fixtures["catalog"]
    route_json = fixtures["route"]
    coordinates = [(float(lon), float(lat)) for lon, lat in route_json["coordinates"]]
    if len(coordinates) < 2:
        raise ValueError("The fictional route needs at least two vertices.")

    session.execute(
        text(
            """
            TRUNCATE TABLE
              audit_events,
              evidence_events,
              response_cases,
              sessions,
              alerts,
              routes,
              export_cables,
              wind_farms,
              users,
              organizations
            RESTART IDENTITY CASCADE
            """
        )
    )

    organization = Organization(
        id=uuid.uuid4(),
        name=catalog["organization_name"],
        is_fictional=True,
    )
    user = User(
        id=uuid.uuid4(),
        organization_id=organization.id,
        email=settings.demo_user_email,
        password_hash=hash_password(settings.demo_user_password),
        role="operator",
        is_fictional=True,
    )
    farm = WindFarm(
        id=uuid.uuid4(),
        organization_id=organization.id,
        name=catalog["wind_farm_name"],
        is_fictional=True,
    )
    cable = ExportCable(
        id=uuid.uuid4(),
        organization_id=organization.id,
        wind_farm_id=farm.id,
        name=catalog["cable_name"],
        is_fictional=True,
    )
    session.add(organization)
    session.flush()
    session.add_all([user, farm])
    session.flush()
    session.add(cable)
    session.flush()
    route_id = uuid.uuid4()
    session.execute(
        text(
            """
            INSERT INTO routes (
              id, organization_id, export_cable_id, name, geom, is_fictional
            )
            VALUES (
              :id, :organization_id, :export_cable_id, :name,
              ST_GeomFromText(:wkt, 4326), true
            )
            """
        ),
        {
            "id": route_id,
            "organization_id": organization.id,
            "export_cable_id": cable.id,
            "name": catalog["route_name"],
            "wkt": linestring_wkt(route_json["coordinates"]),
        },
    )
    session.commit()


def main() -> None:
    import argparse

    from app.db import SessionLocal

    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true")
    parser.parse_args()
    session = SessionLocal()
    try:
        reset_and_seed(session)
    finally:
        session.close()


if __name__ == "__main__":
    main()
