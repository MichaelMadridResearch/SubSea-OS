from pathlib import Path

import yaml

from app.main import app

ROOT = Path(__file__).resolve().parents[2]
FIELDS = {"assumption", "case_ref", "fictional", "summary"}


def test_feasibility_adds_no_write_route() -> None:
    spec = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="utf-8"))
    for path in spec["paths"]:
        assert "feasib" not in path.lower()
    live = {getattr(route, "path", "") or "" for route in app.routes}
    assert all("feasib" not in path.lower() for path in live)
    schema = spec["components"]["schemas"]["DisplayFeasibility"]
    assert set(schema["properties"]) == FIELDS
    display = spec["components"]["schemas"]["Display"]
    assert "feasibility" not in display["required"]
