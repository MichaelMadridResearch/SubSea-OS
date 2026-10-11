import json

from app.seed import load_fixtures

_BANNED_DISPLAY_TEXT = (
    "score",
    "probability",
    "probable failure",
    "recommended action",
    "preferred",
    "high confidence",
    "likely cause",
    "$",
    "£",
    "°",
)
_NOT_SCORED = "Display only. Not scored."


def test_display_fixture_is_precomputed_fiction():
    fixtures = load_fixtures()
    display = fixtures["display"]
    assert display["fictional"] is True
    assert "Not a calculation" in display["assumption"]
    assert [row["external_ref"] for row in display["queue"]] == [
        "FICTIONAL-ALERT-001",
        "SR-021",
        "SR-019",
    ]
    assert [row["severity"] for row in display["queue"]] == ["Critical", "High", "Medium"]
    assert fixtures["alert"]["external_ref"] == "FICTIONAL-ALERT-001"
    assert "SR-021" not in fixtures["alert"]["external_ref"]


def test_hypotheses_and_options_are_read_only_fiction():
    display = load_fixtures()["display"]
    assert "hypotheses" in display
    assert "options" in display
    for name in ("hypotheses", "options"):
        block = display[name]
        assert block["fictional"] is True
        assert block["case_ref"] == "FICTIONAL-ALERT-001"
        assert isinstance(block["assumption"], str)
        assert "Assumption:" in block["assumption"]
    hypotheses = display["hypotheses"]
    options = display["options"]
    assert any(item["status"] == _NOT_SCORED for item in hypotheses["items"])
    assert all("preferred" not in item for item in options["items"])
    serialized = json.dumps(
        {"hypotheses": hypotheses, "options": options},
        ensure_ascii=False,
    )
    # The required status is the only allowed use of "score".
    scanned = serialized.casefold().replace(_NOT_SCORED.casefold(), "")
    for phrase in _BANNED_DISPLAY_TEXT:
        assert phrase.casefold() not in scanned
