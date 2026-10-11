from app.response_rules import build_response
from app.seed import load_fixtures


def _review():
    return build_response(load_fixtures())


def _case(ref: str) -> dict:
    return next(item for item in _review()["active"] if item["ref"] == ref)


def test_response_review_is_deterministic_fiction():
    first = _review()
    second = _review()
    assert first == second
    assert first["fictional"] is True
    assert "Assumption:" in first["assumption"]
    assert "failure probability" in first["assumption"]
    assert first["rule_version"] == "harbor-light-rules-3"
    assert "support score" in first["hypothesis_formula"]
    assert "Advisory score" in first["option_formula"]
    assert [item["ref"] for item in first["active"]] == [
        "FICTIONAL-ALERT-001",
        "SR-021",
        "SR-019",
        "FICTIONAL-MIXED-01",
    ]
    assert len(first["historical"]) == 5
    assert first["unused_assets"][0]["asset"] == "wind-turbine.svg"


def test_known_scenarios_keep_their_advisory_next_step():
    stored = _case("FICTIONAL-ALERT-001")
    disturbance = _case("SR-021")
    decline = _case("SR-019")
    assert stored["vertex_equal"] is True
    assert disturbance["vertex_equal"] is False
    assert decline["vertex_equal"] is False
    assert stored["anomaly_classes"] == ["thermal_hotspot"]
    assert disturbance["anomaly_classes"] == ["external_disturbance"]
    assert decline["anomaly_classes"] == ["insulation_trend"]
    assert stored["hypotheses"][0]["name"] == "Overheating"
    assert disturbance["hypotheses"][0]["name"] == "External impact"
    assert decline["hypotheses"][0]["name"] == "Insulation degradation"
    assert stored["next_step"] == "Request engineering review"
    assert disturbance["next_step"] == "Request a targeted inspection"
    assert decline["next_step"] == "Continue monitoring"
    for item in (stored, disturbance, decline):
        assert item["options"][0]["label"] == item["next_step"]
        assert item["options"][0]["id"] not in {"isolate", "mobilize"}
        _assert_score(item["options"][0])
        assert item["audit"]["recommended_next_step"] == item["next_step"]
        assert "Evidence suggests" in item["audit"]["rationale"]
        assert item["would_reduce"]
        assert item["consequence_model"]["exposure_band"]
        assert "not a cost" in item["consequence_model"]["proxy_statement"]
        assert item["delay_model"]["statement"].startswith("If action waits")
        assert item["audit"]["anomaly_inputs"]
        assert item["audit"]["why_it_won"]
        assert item["audit"]["review_context"]
        assert item["audit"]["options_considered"]
        assert item["precedent"][0]["changes"]
        latest = item["inputs"]["telemetry"][-1]
        assert latest["thermal_index"] == item["inputs"]["signals"]["thermal_index"]
        assert item["hypotheses"][0]["support_score"] - item["hypotheses"][0][
            "conflict_penalty"
        ] - item["hypotheses"][0]["missing_penalty"] == item["hypotheses"][0]["advisory_rank"]
        assert "No equipment was controlled." in item["chronology"][-1]["text"]
        assert item["inputs"]["signals"]
        assert item["inputs"]["marine"]
        assert item["urgency"]
        assert item["feasibility"]
        assert item["consequence_exposure"]
        assert item["prerequisites"]
        assert item["marine"]["vessel_readiness"]
        assert item["marine"]["weather_window"]
        assert item["marine"]["spare_readiness"]
        assert item["marine"]["inspection_feasibility"]
        assert item["evidence_missing"]
        assert item["certainty_limited"] is False
        assert item["precedent"]


def test_mixed_case_limits_certainty_without_a_new_marker():
    mixed = _case("FICTIONAL-MIXED-01")
    assert mixed["marker_id"] == ""
    assert mixed["focus"] == [1.2, 53.6]
    assert mixed["vertex_equal"] is True
    assert "No map symbol was added." in mixed["location_text"]
    assert mixed["certainty_limited"] is True
    assert "Certainty is limited." in mixed["certainty_reason"]
    leaders = [
        row["name"]
        for row in mixed["hypotheses"]
        if row["advisory_rank"] == mixed["hypotheses"][0]["advisory_rank"]
    ]
    assert leaders == ["Insulation degradation", "Overheating"]
    assert mixed["next_step"] == "Continue monitoring"
    assert {item["ref"] for item in mixed["precedent"]} == {
        "FICTIONAL-CLOSED-01",
        "FICTIONAL-CLOSED-03",
    }
    assert mixed["options"][0]["id"] not in {"isolate", "mobilize"}
    assert mixed["options"][0]["advisory_rank"] == 8
    assert mixed["marine"]["scores"]["inspection_feasibility_band"] == 0
    reasons = mixed["precedent"][0]["similarity"]
    assert any("Matched telemetry pattern" in reason for reason in reasons)
    assert "separates the thermal pattern" in mixed["would_reduce"]


def test_derate_is_separate_and_does_not_win():
    alert = _case("FICTIONAL-ALERT-001")
    mixed = _case("FICTIONAL-MIXED-01")
    for case in (alert, mixed):
        derate = next(row for row in case["options"] if row["id"] == "derate")
        assert derate["status"] == "scored"
        assert derate["advisory_rank"] < case["options"][0]["advisory_rank"]
        assert "does not change load" in derate["rationale"]
        assert case["excluded_options"] == []
    for ref in ("SR-021", "SR-019"):
        case = _case(ref)
        assert all(row["id"] != "derate" for row in case["options"])
        assert case["excluded_options"][0]["status"] == "unavailable"
        assert "not justified" in case["excluded_options"][0]["reason"]
    assert mixed["delay_model"]["current_band"] == "Low band"
    assert mixed["delay_model"]["wait_band"] == "Middle band"
    assert alert["delay_model"]["wait_band"] == "High band"
    assert alert["consequence_model"]["proxy_band"] == "High band"
    assert mixed["consequence_model"]["proxy_band"] == "Middle band"


def test_playback_pathway_and_package_keep_the_stored_winner():
    review = _review()
    assert review["rule_version"] == "harbor-light-rules-3"
    assert len(review["historical"]) == 5
    for prior in review["historical"]:
        assert prior["anomaly"]
        assert prior["evidence_that_mattered"]
        assert prior["missing_at_the_time"]
        assert prior["what_changed"]
        assert "advisory_rank" not in prior
    expected = (
        ("FICTIONAL-ALERT-001", "Request engineering review", 12),
        ("SR-021", "Request a targeted inspection", 8),
        ("SR-019", "Continue monitoring", 8),
        ("FICTIONAL-MIXED-01", "Continue monitoring", 8),
    )
    for ref, step, score in expected:
        case = _case(ref)
        assert case["next_step"] == step
        assert case["options"][0]["advisory_rank"] == score
        assert [row["label"] for row in case["delay_pathway"]] == [
            "Now",
            "Next delay band",
            "Later delay band",
        ]
        assert all(row["same_option_holds"] for row in case["delay_pathway"])
        assert case["incident_package"]["recommendation"] == step
        assert "Live re-scoring is still deferred." in case["audit"]["live_rescore"]
        assert case["audit"]["human_approval"]
        assert case["audit"]["elimination"]
        assert case["audit"]["chain"]
        assert case["precedent"][0]["matched"]
        assert case["precedent"][0]["differed"]
        assert "does not replace the current advisory score." in case["precedent"][0]["changes"]
    alert_support = _case("FICTIONAL-ALERT-001")["precedent"][0]["changes"]
    assert "supports the current advisory step" in alert_support
    mixed_support = next(
        item
        for item in _case("FICTIONAL-MIXED-01")["precedent"]
        if item["ref"] == "FICTIONAL-CLOSED-03"
    )
    assert "supports the current advisory step" in mixed_support["changes"]
    assert "The tie still limits certainty." in mixed_support["changes"]
    bands = [row["exposure_band"] for row in _case("FICTIONAL-MIXED-01")["delay_pathway"]]
    assert bands == ["Low band", "Middle band", "High band"]


def test_scenario_layer_keeps_scores_and_adds_context():
    review = _review()
    assert review["rule_version"] == "harbor-light-rules-3"
    assert review["option_formula"].startswith(
        "Advisory score = urgency contribution + feasibility contribution "
    )
    assert review["hypothesis_formula"].startswith(
        "Advisory rank = support score - conflict penalty - missing-evidence penalty."
    )
    expected = (
        ("FICTIONAL-ALERT-001", "Request engineering review", 12),
        ("SR-021", "Request a targeted inspection", 8),
        ("SR-019", "Continue monitoring", 8),
        ("FICTIONAL-MIXED-01", "Continue monitoring", 8),
    )
    approval = "A person approves the next step. This software does not control equipment."
    for ref, step, score in expected:
        case = _case(ref)
        assert case["next_step"] == step
        assert case["options"][0]["advisory_rank"] == score
        labels = {row["label"] for row in case["options"]}
        assert "Temporary stabilization" in labels
        assert "Prepare repair mobilization" in labels
        stabilize = next(row for row in case["options"] if row["id"] == "stabilize")
        mobilize = next(row for row in case["options"] if row["id"] == "mobilize")
        assert stabilize["advisory_rank"] < score
        assert mobilize["advisory_rank"] < score
        assert case["options"][0]["why_not_leading"] == "This is the leading advisory step."
        assert "not a currency amount" in case["bounded_impact"]["statement"]
        assert "not a cost" in case["consequence_model"]["proxy_statement"]
        assert "Not calculated" in " ".join(case["marine"]["readiness"])
        assert case["precedent_influence"]["does_not_replace_score"]
        assert case["incident_package"]["human_approval"] == approval
        assert case["incident_package"]["recommendation"] == step
        assert all(step_row["same_option_holds"] for step_row in case["delay_pathway"])
    mixed = _case("FICTIONAL-MIXED-01")
    assert {item["stance"] for item in mixed["precedent"]} == {"cautionary", "mixed"}
    assert "tie still limits certainty" in mixed["precedent_influence"]["framing"]
    assert "moves from Middle band to High band" in mixed["bounded_impact"]["financial_range"]


def test_fixture_replay_opens_a_case_without_changing_the_score():
    review = _review()
    assert review["rule_version"] == "harbor-light-rules-3"
    expected = (
        ("FICTIONAL-ALERT-001", "Request engineering review", 12),
        ("SR-021", "Request a targeted inspection", 8),
        ("SR-019", "Continue monitoring", 8),
        ("FICTIONAL-MIXED-01", "Continue monitoring", 8),
    )
    for ref, step, score in expected:
        case = _case(ref)
        stream = case["stream"]
        assert case["next_step"] == step
        assert case["options"][0]["advisory_rank"] == score
        assert stream["session_id"] == "harbor-light-replay-1"
        assert stream["frames"][0]["hazard_stage"] == "Watch"
        assert stream["frames"][0]["case_open"] is False
        assert stream["frames"][1]["case_open"] is True
        assert stream["frames"][-1]["fired"] == case["anomaly_classes"]
        assert "does not change the advisory score" in stream["frames"][-1]["reason"]
        assert "does not replace the five-term score" in stream["action_history"][0]
        assert "Not calculated" in stream["strain"]
        assert "Not calculated" in stream["weather"]
        assert any("Response case opened" in line for line in stream["case_updates"])
        assert case["incident_package"]["stream_session"] == "harbor-light-replay-1"
        assert case["incident_package"]["hazard_history"]
        assert case["incident_package"]["anomaly_events"]
    mixed = _case("FICTIONAL-MIXED-01")
    assert mixed["stream"]["hazard_stage"] == "Intervention-critical"
    assert "Two stored rules match" in mixed["stream"]["frames"][-1]["reason"]
    decline = _case("SR-019")
    assert decline["stream"]["hazard_stage"] == "Hazard"


def test_replay_reasoning_explains_without_changing_the_score():
    from app.response_rules import HYPOTHESIS_FORMULA, OPTION_FORMULA

    assert OPTION_FORMULA.startswith(
        "Advisory score = urgency contribution + feasibility contribution "
    )
    assert "support score - conflict penalty - missing-evidence penalty" in HYPOTHESIS_FORMULA
    alert = _case("FICTIONAL-ALERT-001")
    inspection = _case("SR-021")
    decline = _case("SR-019")
    mixed = _case("FICTIONAL-MIXED-01")
    assert [item["next_step"] for item in (alert, inspection, decline, mixed)] == [
        "Request engineering review",
        "Request a targeted inspection",
        "Continue monitoring",
        "Continue monitoring",
    ]
    ranks = [item["options"][0]["advisory_rank"] for item in (alert, inspection, decline, mixed)]
    assert ranks == [12, 8, 8, 8]
    assert alert["incident_package"]["rule_version"] == "harbor-light-rules-3"
    early = alert["stream"]["frames"][0]
    final = alert["stream"]["frames"][-1]
    assert early["evidence_state"] == "incomplete"
    assert early["progress"] == "monitoring only"
    assert early["readiness_stance"] == "not actionable yet"
    assert "Weak early concern" in early["delay_pressure"]
    assert "not a score term" in early["delay_pressure"]
    assert final["evidence_state"] == "conflicting"
    assert "Temperature context" in final["evidence_detail"]
    assert "Load context" in final["evidence_detail"]
    assert "Strain is absent" in final["evidence_detail"]
    assert final["progress"] == "intervention-critical review"
    assert final["readiness_stance"] == "constrained"
    assert "Urgency without score change" in final["delay_pressure"]
    assert "Request engineering review" in final["why_action"]
    assert "Temporary stabilization is not leading" in final["why_not_stabilize"]
    assert "Repair mobilization is not leading" in final["why_not_mobilize"]
    assert "is available" in final["why_derate"]
    assert "New reading" in alert["stream"]["timeline"][0]["text"]
    assert "Stage transition" in alert["stream"]["timeline"][1]["text"]
    assert "Case open event" in alert["stream"]["timeline"][1]["text"]
    assert inspection["stream"]["frames"][-1]["evidence_state"] == "corroborated"
    assert "not available" in inspection["stream"]["frames"][-1]["why_derate"]
    assert decline["stream"]["frames"][-1]["evidence_state"] == "single-signal"
    assert decline["stream"]["frames"][-1]["readiness_stance"] == "delayed"
    assert mixed["stream"]["frames"][-1]["evidence_state"] == "conflicting"
    assert mixed["stream"]["frames"][-1]["readiness_stance"] == "delayed"
    package = mixed["incident_package"]
    assert "A person approves the next step. This software does not control equipment." == (
        package["human_approval"]
    )
    assert "Strain is absent" in package["missing_evidence_summary"]
    assert package["corroboration_summary"]
    assert len(package["readiness_stances"]) == 3
    assert len(package["recommendation_rationales"]) == 3
    assert package["readiness_stances"][0].startswith("T1: not actionable yet")
    again = _case("FICTIONAL-ALERT-001")
    assert again["stream"]["frames"] == alert["stream"]["frames"]
    assert again["options"][0]["advisory_rank"] == 12


def test_option_scores_stay_stable_for_the_harbor_light_cases():
    assert _case("FICTIONAL-ALERT-001")["options"][0]["advisory_rank"] == 12
    assert _case("SR-021")["options"][0]["advisory_rank"] == 8
    assert _case("SR-019")["options"][0]["advisory_rank"] == 8
    inspect = next(row for row in _case("SR-021")["options"] if row["id"] == "inspect")
    assert inspect["components"]["urgency"] == 4
    assert inspect["components"]["feasibility"] == 4


def test_marine_bands_change_the_inspection_score():
    fixtures = load_fixtures()
    before = next(
        row["advisory_rank"]
        for row in _case("FICTIONAL-MIXED-01")["options"]
        if row["id"] == "inspect"
    )
    mixed = next(
        item for item in fixtures["response"]["active"] if item["ref"] == "FICTIONAL-MIXED-01"
    )
    mixed["execution"]["vessel"] = 2
    mixed["execution"]["weather"] = 2
    mixed["execution"]["inspection"] = 2
    mixed["execution"]["prerequisites"] = 2
    after_case = next(
        item for item in build_response(fixtures)["active"] if item["ref"] == "FICTIONAL-MIXED-01"
    )
    after = next(row["advisory_rank"] for row in after_case["options"] if row["id"] == "inspect")
    assert after > before
    assert after_case["next_step"] == "Continue monitoring"


def _assert_score(option: dict) -> None:
    parts = option["components"]
    assert (
        parts["urgency"]
        + parts["feasibility"]
        + parts["consequence_reduction"]
        - parts["execution_burden"]
        - parts["uncertainty_penalty"]
        == option["advisory_rank"]
    )


def test_authored_link_is_not_a_proximity_match():
    disturbance = _case("SR-021")
    assert "No proximity match was applied." in disturbance["location_text"]
    assert disturbance["segment_id"] == "segment-export"
