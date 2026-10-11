import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api"))

from app.db import SessionLocal, engine  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402


def postgres_up() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False


@pytest.fixture(scope="session")
def database():
    if not postgres_up():
        if os.environ.get("SUBSEA_REQUIRE_DB") == "1":
            pytest.fail("PostgreSQL is not reachable")
        pytest.skip("PostgreSQL is not reachable")
    from alembic import command
    from alembic.config import Config

    config = Config(str(ROOT / "apps" / "api" / "alembic.ini"))
    command.upgrade(config, "head")
    session = SessionLocal()
    try:
        reset_and_seed(session)
    finally:
        session.close()
