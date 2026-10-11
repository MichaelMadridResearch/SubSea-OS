from app.stream_replay import build_stream

"""Deterministic response rules for the Harbor Light demonstration.

Advisory ranks are weights over fixture indices. They are not a failure probability.
"""

HYPOTHESES = (
    "Overheating",
    "Insulation degradation",
    "External impact",
    "Cable exposure",
    "Free span",
    "Inconclusive",
)

HYPOTHESIS_FORMULA = (
    "Advisory rank = support score - conflict penalty - missing-evidence penalty. "
    "Support score is the support count times consistency. "
    "Conflict penalty is the conflict count times the uncertainty penalty. "
    "The missing-evidence penalty uses the missing-row count times the missing weight, "
    "and that count is the same for every hypothesis."
)

OPTION_FORMULA = (
    "Advisory score = urgency contribution + feasibility contribution "
    "+ consequence reduction - execution burden penalty - uncertainty penalty. "
    "Each contribution is a stored band times its stored weight. "
    "Inspection feasibility uses the lowest of the vessel, weather-window, and inspection bands. "
    "A derate review is scored only when the thermal hotspot rule matches and the load index "
    "meets the stored threshold. The wait projection is not a sixth score term."
)


def build_response(fixtures: dict) -> dict:
    spec = fixtures["response"]
    display = fixtures["display"]
    route = fixtures["route"]["coordinates"]
    markers = {item["id"]: item["coordinates"] for item in display["markers"]}
    segments = {item["id"]: item for item in spec["topology"]["segments"]}
    active = [
        _evaluate(spec, scenario, markers.get(scenario["marker_id"]), route, segments)
        for scenario in spec["active"]
    ]
    return {
        "fictional": True,
        "assumption": spec["assumption"],
        "rule_version": spec["rule_version"],
        "weights": spec["weights"],
        "thresholds": spec["thresholds"],
        "assets": spec["topology"]["assets"],
        "unused_assets": spec["topology"]["unused_assets"],
        "hypothesis_formula": HYPOTHESIS_FORMULA,
        "option_formula": OPTION_FORMULA,
        "active": active,
        "historical": spec["historical"],
    }


def _pair(value: list | None) -> list[float] | None:
    if not isinstance(value, list) or len(value) < 2:
        return None
    return [float(value[0]), float(value[1])]


def _same(left: list[float], right: list) -> bool:
    other = _pair(right)
    return other is not None and left == other


def _rules(signals: dict, thresholds: dict) -> list[str]:
    fired: list[str] = []
    if (
        signals["thermal_index"] >= thresholds["thermal_index"]
        and signals["load_index"] >= thresholds["load_index"]
        and signals["persistence"] is True
    ):
        fired.append("thermal_hotspot")
    if (
        signals["acoustic_index"] >= thresholds["acoustic_index"]
        and signals["vessel_window"] is True
    ):
        fired.append("external_disturbance")
    if signals["insulation_decline_count"] >= thresholds["insulation_decline_count"]:
        fired.append("insulation_trend")
    if (
        signals["survey_burial"] == "exposure"
        and signals["movement_index"] >= thresholds["movement_index"]
    ):
        fired.append("exposure_movement")
    return fired


def _hypothesis_rows(
    signals: dict, fired: list[str], weights: dict, missing_count: int
) -> list[dict]:
    buried = signals["survey_burial"] == "intact"
    missing_penalty = missing_count * weights["missing"]
    rows = []
    for name in HYPOTHESES:
        support, conflict, support_text, conflict_text = _hypothesis_case(
            name, signals, fired, buried
        )
        support_score = support * weights["consistency"]
        conflict_penalty = conflict * weights["uncertainty_penalty"]
        rank = support_score - conflict_penalty - missing_penalty
        rows.append(
            {
                "name": name,
                "advisory_rank": rank,
                "support_score": support_score,
                "conflict_penalty": conflict_penalty,
                "missing_penalty": missing_penalty,
                "support": support_text,
                "conflict": conflict_text,
                "explanation": (
                    f"Support score {support_score}. Conflict penalty {conflict_penalty}. "
                    f"Missing-evidence penalty {missing_penalty}. Advisory rank {rank}. "
                    f"{support_text} {conflict_text}"
                ),
            }
        )
    rows.sort(key=lambda row: (-row["advisory_rank"], row["name"]))
    return rows


def _hypothesis_case(
    name: str, signals: dict, fired: list[str], buried: bool
) -> tuple[int, int, str, str]:
    if name == "Overheating":
        support = int("thermal_hotspot" in fired)
        conflict = int(buried)
        return (
            support,
            conflict,
            "The thermal hotspot rule matched the stored indices."
            if support
            else "The thermal hotspot rule did not match.",
            "The stored survey describes burial as intact."
            if conflict
            else "The stored survey does not describe intact burial.",
        )
    if name == "Insulation degradation":
        support = int("insulation_trend" in fired)
        conflict = int("thermal_hotspot" in fired)
        return (
            support,
            conflict,
            "The insulation trend rule matched the stored decline count."
            if support
            else "The insulation decline count stays under the demonstration threshold.",
            "A thermal hotspot rule also matched, so the pattern is mixed."
            if conflict
            else "No thermal hotspot rule matched.",
        )
    if name == "External impact":
        support = int("external_disturbance" in fired)
        conflict = int(signals["vessel_window"] is False)
        return (
            support,
            conflict,
            "The acoustic index and the vessel window both matched."
            if support
            else "The acoustic index and the vessel window did not both match.",
            "No vessel window is recorded."
            if conflict
            else "A vessel window is recorded.",
        )
    if name == "Cable exposure":
        support = int(signals["survey_burial"] == "exposure")
        conflict = int(buried)
        return (
            support,
            conflict,
            "The stored survey burial value is exposure."
            if support
            else "The stored survey burial value is not exposure.",
            "The stored survey describes burial as intact."
            if conflict
            else "The stored survey does not describe intact burial.",
        )
    if name == "Free span":
        support = int("exposure_movement" in fired)
        conflict = int(buried or signals["movement_index"] < 4)
        return (
            support,
            conflict,
            "The exposure and movement rule matched."
            if support
            else "The exposure and movement rule did not match.",
            "Burial is intact or the movement index stays under the demonstration threshold."
            if conflict
            else "Movement and exposure are both recorded.",
        )
    return (
        0,
        0,
        "This row stays visible when no other pattern matches.",
        "No conflicting row removes this option.",
    )


def _severity_band(severity: str) -> int:
    return {"Critical": 3, "High": 2, "Medium": 1}.get(severity, 0)


def _exposure_band(outage: int, service: int) -> str:
    total = outage + service
    if total >= 5:
        return "High band"
    if total >= 3:
        return "Middle band"
    return "Low band"


def _option_points(option_id: str, ctx: dict) -> tuple[dict[str, int], str]:
    inspect_feas = min(ctx["vessel"], ctx["weather"], ctx["inspection"])
    mobilize_feas = min(ctx["vessel"], ctx["spare"])
    if option_id == "monitor":
        points = {
            "urgency": 2 if ctx["severity_band"] == 1 else 0,
            "feasibility": 2,
            "consequence": 0,
            "burden": 0,
            "uncertainty": 0,
        }
        note = (
            "The tie keeps the next human step on watching. Name order is not extra certainty."
            if ctx["limited"]
            else "Watching matches a medium window and does not need a vessel."
            if ctx["severity_band"] == 1
            else "Watching does not answer a higher severity window."
        )
        return points, note
    if option_id == "review":
        thermal_urgent = ctx["thermal"] and ctx["severity_band"] == 3
        points = {
            "urgency": 3 if thermal_urgent else (1 if ctx["thermal"] else 0),
            "feasibility": 2,
            "consequence": 2 if ctx["outage_band"] >= 3 else (1 if ctx["outage_band"] >= 2 else 0),
            "burden": 1,
            "uncertainty": 2 if ctx["limited"] else 0,
        }
        note = (
            "Down-ranked because the leading patterns tie. Certainty is limited."
            if ctx["limited"]
            else "A desk review does not need a vessel."
        )
        return points, note
    if option_id == "inspect":
        ready = inspect_feas == 2
        points = {
            "urgency": 2 if ctx["external"] or ctx["exposure"] else 0,
            "feasibility": inspect_feas,
            "consequence": 1 if ctx["missing"] else 0,
            "burden": (1 if ready else 2) + (0 if ctx["prerequisites"] >= 2 else 1),
            "uncertainty": 2 if ctx["limited"] or inspect_feas == 0 else 0,
        }
        if inspect_feas == 0:
            note = (
                "Down-ranked because the vessel, weather window, or inspection band is not ready."
            )
        elif ctx["limited"]:
            note = "Down-ranked because the leading patterns tie. Certainty is limited."
        else:
            note = (
                "The inspection band is the lowest of vessel, weather window, "
                "and inspection readiness."
            )
        return points, note
    if option_id == "isolate":
        points = {
            "urgency": 1 if ctx["severity_band"] == 3 else 0,
            "feasibility": 0,
            "consequence": min(2, ctx["outage_band"]),
            "burden": 3,
            "uncertainty": 2,
        }
        note = (
            "Down-ranked because a person would have to choose an isolation review. "
            "This software does not control equipment."
        )
        return points, note
    if option_id == "stabilize":
        points = {
            "urgency": 1 if ctx["severity_band"] >= 2 else 0,
            "feasibility": 1,
            "consequence": 1 if ctx["outage_band"] >= 2 else 0,
            "burden": 2,
            "uncertainty": 2 if ctx["limited"] else 1,
        }
        note = (
            "Down-ranked because a temporary hold still needs a person. "
            "This software does not change load or isolate equipment."
        )
        return points, note
    if option_id == "derate":
        points = {
            "urgency": 2 if ctx["severity_band"] == 3 else (1 if ctx["thermal"] else 0),
            "feasibility": 0,
            "consequence": 2 if ctx["outage_band"] >= 3 else (1 if ctx["outage_band"] >= 2 else 0),
            "burden": 3,
            "uncertainty": 2 if ctx["limited"] or ctx["prerequisites"] < 2 else 1,
        }
        note = (
            "Down-ranked because a person would have to choose a derate review. "
            "This software does not change load or isolate equipment."
        )
        return points, note
    points = {
        "urgency": 0,
        "feasibility": mobilize_feas,
        "consequence": 1 if ctx["spare"] >= 1 else 0,
        "burden": 3 + (1 if ctx["mobilization_lead"] >= 2 else 0),
        "uncertainty": 2,
    }
    if ctx["spare"] < 1:
        note = (
            "Down-ranked because no spare is staged. This software does not dispatch a repair."
        )
    else:
        note = (
            "A person would have to choose mobilization. This software does not dispatch a repair."
        )
    return points, note


def _scale(points: dict[str, int], weights: dict) -> dict[str, int]:
    return {
        "urgency": points["urgency"] * weights["urgency"],
        "feasibility": points["feasibility"] * weights["feasibility"],
        "consequence_reduction": points["consequence"] * weights["consequence"],
        "execution_burden": points["burden"] * weights["burden"],
        "uncertainty_penalty": points["uncertainty"] * weights["uncertainty_penalty"],
    }


def _score(components: dict[str, int]) -> int:
    return (
        components["urgency"]
        + components["feasibility"]
        + components["consequence_reduction"]
        - components["execution_burden"]
        - components["uncertainty_penalty"]
    )


def _execution_note(option_id: str, ctx: dict) -> str:
    if option_id == "derate":
        return (
            "Prerequisites: the thermal hotspot rule matched and the load index "
            "meets the stored threshold. A person must choose this review."
        )
    if option_id == "inspect" and ctx["inspect_band"] > 0:
        return (
            f"Technically plausible at inspection band {ctx['inspect_band']}. "
            "It stays behind any higher advisory score."
        )
    if option_id == "mobilize" and ctx["spare"] < 1:
        return (
            "Mobilization stays unattractive because no spare is staged, "
            "even as a person-only request."
        )
    if option_id == "stabilize":
        return (
            "A temporary hold needs a person. "
            "This software does not change load or isolate equipment."
        )
    if option_id == "monitor" and ctx["wait_rises"]:
        return (
            "If action waits, the exposure band steps up. "
            "The advisory score still uses the current bands."
        )
    return ""


def _options(spec: dict, ctx: dict) -> tuple[list[dict], list[dict]]:
    weights = spec["weights"]
    rows = []
    excluded = []
    for option in spec["options"]:
        if option["id"] == "derate" and not ctx["derate_justified"]:
            excluded.append(
                {
                    "id": option["id"],
                    "label": option["label"],
                    "status": "unavailable",
                    "reason": (
                        "The thermal hotspot rule did not match, or the load index "
                        "stays under the stored threshold, so a derate review is not justified."
                    ),
                }
            )
            continue
        points, note = _option_points(option["id"], ctx)
        components = _scale(points, weights)
        rank = _score(components)
        extra = _execution_note(option["id"], ctx)
        rows.append(
            {
                "id": option["id"],
                "label": option["label"],
                "status": "scored",
                "advisory_rank": rank,
                "components": components,
                "execution_note": extra,
                "rationale": (
                    f"Evidence suggests {option['label']}. "
                    f"Urgency contribution {components['urgency']}. "
                    f"Feasibility contribution {components['feasibility']}. "
                    f"Consequence reduction {components['consequence_reduction']}. "
                    f"Execution burden penalty {components['execution_burden']}. "
                    f"Uncertainty penalty {components['uncertainty_penalty']}. "
                    f"Advisory score {rank}. {note}"
                    + (f" {extra}" if extra else "")
                ),
                "comparison": _comparison_profile(option["id"], points, ctx),
            }
        )
    rows.sort(key=lambda row: (-row["advisory_rank"], row["label"]))
    for row in rows:
        if row["id"] == rows[0]["id"]:
            row["why_not_leading"] = "This is the leading advisory step."
        else:
            detail = row["execution_note"] or "The five-term score keeps it off the winner."
            row["why_not_leading"] = (
                f"Advisory score {row['advisory_rank']} stays below the leading step. {detail}"
            )
    return rows, excluded


def _band_from_count(value: int) -> str:
    if value >= 3:
        return "High band"
    if value >= 2:
        return "Middle band"
    return "Low band"


def _comparison_profile(option_id: str, points: dict, ctx: dict) -> dict:
    feasibility = {2: "Ready", 1: "Constrained"}.get(points["feasibility"], "Not ready")
    burden = points["burden"]
    if burden >= 3:
        prerequisite_burden = "Heavy"
    elif burden == 2:
        prerequisite_burden = "Middle"
    elif burden == 1:
        prerequisite_burden = "Light"
    else:
        prerequisite_burden = "None"
    if option_id == "mobilize" and ctx["spare"] < 1:
        financial_pressure = "High band"
    elif option_id == "stabilize" and ctx["outage_band"] >= 2:
        financial_pressure = "Middle band"
    elif ctx["outage_band"] >= 3:
        financial_pressure = "Middle band"
    else:
        financial_pressure = "Low band"
    if ctx["limited"]:
        confidence = "Limited by the tied patterns."
    elif points["feasibility"] == 0:
        confidence = "Constrained by readiness."
    else:
        confidence = "The stored bands support a watch, not a probability."
    return {
        "feasibility": feasibility,
        "prerequisite_burden": prerequisite_burden,
        "downtime_pressure": _band_from_count(ctx["outage_band"]),
        "financial_pressure": financial_pressure,
        "confidence": confidence,
    }


def _delay_model(inputs: dict, current_band: str) -> tuple[dict, bool]:
    step = 1 if inputs["delay_band"] >= 2 else 0
    wait_outage = min(3, inputs["outage_band"] + step)
    wait_service = min(3, inputs["service_band"] + step)
    wait_band = _exposure_band(wait_outage, wait_service)
    if wait_band == current_band:
        statement = f"If action waits, the exposure band stays {current_band}."
        return {
            "current_band": current_band,
            "wait_band": wait_band,
            "statement": statement,
        }, False
    statement = f"If action waits, the exposure band moves from {current_band} to {wait_band}."
    return {"current_band": current_band, "wait_band": wait_band, "statement": statement}, True


def _proxy(inputs: dict) -> tuple[str, int, str]:
    index = (
        inputs["outage_band"]
        + inputs["service_band"]
        + inputs["delay_band"]
        + inputs["lead_time_band"]
    )
    if index >= 8:
        band = "High band"
    elif index >= 4:
        band = "Middle band"
    else:
        band = "Low band"
    statement = (
        f"Consequence proxy: {band}. "
        f"Index {index} sums the outage, service, delay, and lead-time bands. "
        "This is not a cost."
    )
    return band, index, statement


def _precedent_change(prior: dict, next_step: str, limited: bool) -> str:
    if prior["chosen"] == next_step:
        text = (
            "This precedent supports the current advisory step. "
            "It does not replace the current advisory score."
        )
    else:
        text = (
            f"This precedent used {prior['chosen']}. "
            "It does not replace the current advisory score."
        )
    if limited:
        text += " The tie still limits certainty."
    return text


MARINE_PATHWAY = (
    "Marine bands stay at the stored snapshot. "
    "They do not improve or worsen along this pathway."
)

LIVE_RESCORE = "Closed cases stay recorded outcomes. Live re-scoring is still deferred."


def _stance(chosen: str, next_step: str, limited: bool) -> str:
    if chosen == next_step and limited:
        return "mixed"
    if chosen == next_step:
        return "supportive"
    return "cautionary"


def _influence(precedent: list[dict]) -> dict:
    groups = {"supportive": [], "cautionary": [], "mixed": []}
    for item in precedent:
        groups[item["stance"]].append(item["ref"])
    boundary = "Precedent influence does not replace the current advisory score."
    if groups["mixed"]:
        framing = (
            "A mixed precedent supports the step while the tie still limits certainty. "
            + boundary
        )
    elif groups["cautionary"]:
        framing = "A cautionary precedent used a different step. " + boundary
    elif groups["supportive"]:
        framing = "Supporting precedents agree with the current step. " + boundary
    else:
        framing = "No cited precedent is stored. " + boundary
    return {
        "supportive": groups["supportive"],
        "cautionary": groups["cautionary"],
        "mixed": groups["mixed"],
        "framing": framing,
        "does_not_replace_score": boundary,
    }


def _bounded(pathway: list[dict]) -> dict:
    start = pathway[0]["proxy_band"]
    end = pathway[-1]["proxy_band"]
    interruption = pathway[0]["exposure_band"]
    if start == end:
        range_text = f"Bounded range stays {start}."
        sensitivity = "Waiting keeps the bounded range on the current proxy band."
    else:
        range_text = f"Bounded range moves from {start} to {end}."
        sensitivity = "Waiting moves the bounded range along the delay pathway."
    statement = (
        f"{range_text} Downtime outlook {interruption}. "
        "Interruption severity uses the outage and service bands. It is not a duration. "
        "This is an index range beside the consequence proxy. "
        "It is not a currency amount and not a cost."
    )
    return {
        "downtime_outlook": interruption,
        "interruption_severity": interruption,
        "financial_range": range_text,
        "delay_sensitivity": sensitivity,
        "statement": statement,
    }


def _comparison(reasons: list[str]) -> tuple[list[str], list[str]]:
    matched = [reason for reason in reasons if reason.startswith("Matched")]
    differed = [reason for reason in reasons if not reason.startswith("Matched")]
    return matched, differed


def _delay_pathway(spec: dict, ctx: dict, inputs: dict, winner_id: str) -> list[dict]:
    delay = inputs["delay_band"]
    next_steps = 1 if delay >= 1 else 0
    later_steps = 2 if delay >= 2 else next_steps
    stages = []
    for label, steps in (
        ("Now", 0),
        ("Next delay band", next_steps),
        ("Later delay band", later_steps),
    ):
        outage = min(3, inputs["outage_band"] + steps)
        service = min(3, inputs["service_band"] + steps)
        shifted = {**inputs, "outage_band": outage, "service_band": service}
        proxy_band, _index, _statement = _proxy(shifted)
        rows, _excluded = _options(spec, {**ctx, "outage_band": outage})
        stages.append(
            {
                "label": label,
                "exposure_band": _exposure_band(outage, service),
                "outage_band": outage,
                "service_band": service,
                "proxy_band": proxy_band,
                "marine": MARINE_PATHWAY,
                "leading_option": rows[0]["label"],
                "same_option_holds": rows[0]["id"] == winner_id,
                "bounded_outlook": (
                    f"Bounded range at this step: {proxy_band}. "
                    "This is not a currency amount and not a cost."
                ),
            }
        )
    return stages


def _split_evidence(
    items: list[dict], fired: list[str]
) -> tuple[list[dict], list[dict], list[dict]]:
    grouped = {"for": [], "against": [], "missing": []}
    for item in items:
        grouped[item["stance"]].append({"source": item["source"], "text": item["text"]})
    if fired:
        grouped["for"].append(
            {
                "source": "Rule evaluation",
                "text": "Rules that matched: " + ", ".join(fired) + ".",
            }
        )
    else:
        grouped["missing"].append(
            {
                "source": "Rule evaluation",
                "text": "No demonstration rule matched. The row stays inconclusive.",
            }
        )
    return grouped["for"], grouped["against"], grouped["missing"]


def _leaders(hypotheses: list[dict]) -> list[dict]:
    if not hypotheses:
        return []
    lead = hypotheses[0]["advisory_rank"]
    return [row for row in hypotheses if row["advisory_rank"] == lead]


def _urgency(severity: str, limited: bool) -> str:
    if limited:
        return "Urgency stays limited while the leading patterns tie."
    stated = {
        "Critical": "A person should review this window.",
        "High": "A person should consider inspection in this window.",
        "Medium": "Watching can continue through this window.",
    }
    return stated.get(severity, "Urgency is not stated.")


def _feasibility(marine: dict, execution: dict, inspect_band: int) -> str:
    return (
        f"{marine['inspection_feasibility']} "
        f"Vessel band {execution['vessel']}. "
        f"Weather-window band {execution['weather']}. "
        f"Spare band {execution['spare']}. "
        f"Inspection band {execution['inspection']}. "
        f"The inspection feasibility contribution uses the lowest of those three bands "
        f"({inspect_band})."
    )


def _prerequisites(next_id: str, limited: bool) -> str:
    if limited:
        return (
            "A person has to separate the tied patterns. "
            "This software does not control equipment."
        )
    if next_id == "inspect":
        return (
            "A person requests the inspection. "
            "The stored vessel and weather window are the constraints."
        )
    if next_id == "review":
        return "A person opens the engineering review. No equipment is controlled."
    return "No new action is required beyond watching the stored indices."


def _location(scenario: dict, point: list[float] | None, vertex_equal: bool, segment: dict) -> str:
    linked = f"The fixture links it to {segment['label']}."
    if scenario.get("marker_id"):
        if vertex_equal and point is not None:
            return (
                f"Marker {scenario['marker_id']} equals stored route vertex "
                f"{point[0]}, {point[1]}. {linked}"
            )
        return (
            f"Marker {scenario['marker_id']} is not a stored route vertex. "
            f"{linked} No proximity match was applied."
        )
    if vertex_equal and point is not None:
        return (
            f"Stored route vertex {point[0]}, {point[1]}. "
            f"No map symbol was added. {linked}"
        )
    return "This row has no stored route vertex. No proximity match was applied."


def _missing_count(items: list[dict]) -> int:
    return sum(1 for item in items if item["stance"] == "missing")


def _similarity(scenario: dict, prior: dict, segment: dict, limited: bool) -> list[str]:
    reasons = [f"Matched telemetry pattern: {prior['pattern']}."]
    if prior.get("segment_id") == scenario["segment_id"]:
        reasons.append(f"Matched route context: {segment['label']}.")
    else:
        reasons.append("Different route context from this case.")
    reasons.append(f"Inspection outcome: {prior['inspection_outcome']}")
    if prior.get("spare_ready") == scenario["execution"]["spare"]:
        reasons.append("Matched marine constraint: spare readiness is the same band.")
    else:
        reasons.append("Different marine constraint: spare readiness is not the same band.")
    if limited:
        reasons.append(
            "Important difference: this case ties two hypotheses. "
            "Name order is not extra certainty."
        )
    else:
        reasons.append(f"Important difference: {prior['difference']}")
    return reasons


def _evaluate(spec: dict, scenario: dict, marker: list | None, route: list, segments: dict) -> dict:
    signals = scenario["signals"]
    marine = scenario["marine"]
    execution = scenario["execution"]
    consequence_inputs = scenario["consequence_inputs"]
    fired = _rules(signals, spec["thresholds"])
    missing_count = _missing_count(scenario["evidence"])
    hypotheses = _hypothesis_rows(signals, fired, spec["weights"], missing_count)
    leaders = _leaders(hypotheses)
    limited = len(leaders) > 1
    top = hypotheses[0]["name"]
    inspect_band = min(execution["vessel"], execution["weather"], execution["inspection"])
    ctx = {
        "vessel": execution["vessel"],
        "weather": execution["weather"],
        "spare": execution["spare"],
        "inspection": execution["inspection"],
        "mobilization_lead": execution["mobilization_lead"],
        "prerequisites": execution["prerequisites"],
        "severity_band": _severity_band(scenario["severity"]),
        "outage_band": consequence_inputs["outage_band"],
        "thermal": "thermal_hotspot" in fired,
        "external": "external_disturbance" in fired,
        "exposure": "exposure_movement" in fired or signals["survey_burial"] == "exposure",
        "limited": limited,
        "missing": missing_count > 0,
        "inspect_band": inspect_band,
        "derate_justified": (
            "thermal_hotspot" in fired
            and signals["load_index"] >= spec["thresholds"]["load_index"]
        ),
        "wait_rises": _delay_model(
            consequence_inputs,
            _exposure_band(consequence_inputs["outage_band"], consequence_inputs["service_band"]),
        )[1],
    }
    options, excluded = _options(spec, ctx)
    next_step = options[0]["label"]
    delay_pathway = _delay_pathway(spec, ctx, consequence_inputs, options[0]["id"])
    point = _pair(marker) if scenario.get("marker_id") else _pair(scenario.get("vertex"))
    vertex_equal = point is not None and any(_same(point, vertex) for vertex in route)
    segment = segments[scenario["segment_id"]]
    evidence_for, evidence_against, evidence_missing = _split_evidence(scenario["evidence"], fired)
    leader_names = {row["name"] for row in leaders}
    precedent = []
    for item in spec["historical"]:
        if item["pattern"] not in leader_names:
            continue
        reasons = _similarity(scenario, item, segment, limited)
        matched, differed = _comparison(reasons)
        precedent.append(
            {
                "ref": item["ref"],
                "outcome": item["outcome"],
                "lesson": item["lesson"],
                "similarity": reasons,
                "matched": matched,
                "differed": differed,
                "changes": _precedent_change(item, next_step, limited),
                "stance": _stance(item["chosen"], next_step, limited),
            }
        )
    influence = _influence(precedent)
    bounded = _bounded(delay_pathway)
    if limited:
        names = " and ".join(row["name"] for row in leaders)
        rank = hypotheses[0]["advisory_rank"]
        uncertainty = (
            f"{names} share advisory rank {rank}. "
            "Conflicting stored evidence is listed. Certainty is limited."
        )
        placed = (
            f"Advisory rank ties {names} at {rank}. "
            "Name order is not extra certainty."
        )
    else:
        uncertainty = (
            "Conflicting evidence is listed. The advisory rank is not certain."
            if evidence_against
            else "No conflicting evidence is listed."
        )
        placed = f"Advisory rank placed {top} first."
    chronology = [
        {
            "order": "1",
            "text": f"Stored signals recorded for {scenario['ref']}. {scenario['opened']}.",
        },
        {
            "order": "2",
            "text": (
                f"Rule {spec['rule_version']} recorded "
                f"{', '.join(fired) if fired else 'no class'}."
            ),
        },
        {"order": "3", "text": placed},
        {
            "order": "4",
            "text": (
                f"Advisory next step: {next_step}. "
                f"Advisory score {options[0]['advisory_rank']}. "
                "No equipment was controlled."
            ),
        },
    ]
    exposure = _exposure_band(
        consequence_inputs["outage_band"], consequence_inputs["service_band"]
    )
    delay_model, _wait_rises = _delay_model(consequence_inputs, exposure)
    proxy_band, proxy_index, proxy_statement = _proxy(consequence_inputs)
    would_reduce = (
        evidence_missing[0]["text"]
        if evidence_missing
        else "No missing evidence is listed."
    )
    marine_view = {
        **marine,
        "mobilization_lead_time": execution["mobilization_lead_time"],
        "prerequisite_completeness": execution["prerequisite_completeness"],
        "scores": {
            "vessel": execution["vessel"],
            "weather": execution["weather"],
            "spare": execution["spare"],
            "inspection": execution["inspection"],
            "mobilization_lead": execution["mobilization_lead"],
            "prerequisites": execution["prerequisites"],
            "inspection_feasibility_band": inspect_band,
        },
        "ranking_effect": (
            "Inspection feasibility uses the lowest of the vessel, weather-window, "
            f"and inspection bands ({inspect_band}). That band changes the inspection score. "
            f"Spare band {execution['spare']} keeps mobilization "
            + (
                "unattractive."
                if execution["spare"] < 1
                else "available for a person to review."
            )
            + (
                f" Prerequisite band {execution['prerequisites']} adds execution burden "
                "when it is below 2."
                if execution["prerequisites"] < 2
                else f" Prerequisite band {execution['prerequisites']} does not add that burden."
            )
        ),
        "readiness": [
            f"Vessel requirement. Band {execution['vessel']}. {marine['vessel_readiness']}",
            f"Weather sensitivity. Band {execution['weather']}. {marine['weather_window']}",
            f"Spare readiness. Band {execution['spare']}. {marine['spare_readiness']}",
            "Crew or tool dependency. Not calculated. No crew or tool record is stored.",
            f"Permit or approval dependency. {execution['permit_delay']}",
            (
                f"Mobilization lead burden. Band {execution['mobilization_lead']}. "
                f"{execution['mobilization_lead_time']}"
            ),
        ],
    }
    assumptions = [
        spec["assumption"],
        (
            f"Outage band {consequence_inputs['outage_band']}. "
            f"Service band {consequence_inputs['service_band']}. "
            f"Delay band {consequence_inputs['delay_band']}. "
            f"Lead-time band {consequence_inputs['lead_time_band']}."
        ),
        execution["inspection_lead_time"],
        execution["repair_lead_time"],
        execution["permit_delay"],
        "Bands are stored indices. They are not a measurement and not a failure probability.",
        proxy_statement,
    ]
    stream = build_stream(
        scenario,
        spec["thresholds"],
        _rules,
        segment["label"],
        next_step,
        options[0]["advisory_rank"],
    )
    return {
        "ref": scenario["ref"],
        "marker_id": scenario.get("marker_id") or "",
        "segment_id": scenario["segment_id"],
        "severity": scenario["severity"],
        "opened": scenario["opened"],
        "vertex_equal": vertex_equal,
        "location_text": _location(scenario, point, vertex_equal, segment),
        "focus": point if point and not scenario.get("marker_id") else [],
        "anomaly_classes": fired,
        "context": scenario["context"],
        "inputs": {
            "thresholds": spec["thresholds"],
            "signals": signals,
            "marine": marine,
            "execution": execution,
            "consequence_inputs": consequence_inputs,
            "telemetry": scenario["telemetry"],
        },
        "evidence_for": evidence_for,
        "evidence_against": evidence_against,
        "evidence_missing": evidence_missing,
        "hypotheses": hypotheses,
        "options": options,
        "excluded_options": excluded,
        "next_step": next_step,
        "urgency": _urgency(scenario["severity"], limited),
        "feasibility": _feasibility(marine, execution, inspect_band),
        "consequence_exposure": f"{scenario['consequence']} Exposure band: {exposure}.",
        "consequence_model": {
            "outage_exposure": consequence_inputs["outage_band"],
            "service_impact": consequence_inputs["service_band"],
            "delay_sensitivity": consequence_inputs["delay_band"],
            "lead_time_effect": consequence_inputs["lead_time_band"],
            "exposure_band": exposure,
            "inspection_lead_time": execution["inspection_lead_time"],
            "repair_lead_time": execution["repair_lead_time"],
            "permit_delay": execution["permit_delay"],
            "proxy_band": proxy_band,
            "proxy_index": proxy_index,
            "proxy_statement": proxy_statement,
            "assumptions": [
                "Bands are stored indices from the case assumptions.",
                proxy_statement,
            ],
        },
        "delay_model": delay_model,
        "delay_pathway": delay_pathway,
        "bounded_impact": bounded,
        "precedent_influence": influence,
        "stream": stream,
        "uncertainty": uncertainty,
        "would_reduce": would_reduce,
        "prerequisites": _prerequisites(options[0]["id"], limited),
        "marine": marine_view,
        "certainty_limited": limited,
        "certainty_reason": uncertainty if limited else "",
        "consequence": scenario["consequence"],
        "audit": {
            "recommended_next_step": next_step,
            "rationale": options[0]["rationale"],
            "why_it_won": (
                f"{next_step} has the highest advisory score "
                f"({options[0]['advisory_rank']}) for the stored bands."
                + (" The tie does not add certainty." if limited else "")
            ),
            "anomaly_inputs": (
                f"Thermal {signals['thermal_index']}. Load {signals['load_index']}. "
                f"Acoustic {signals['acoustic_index']}. "
                f"Insulation decline count {signals['insulation_decline_count']}."
            ),
            "options_considered": [
                {
                    "label": row["label"],
                    "status": row["status"],
                    "score_text": str(row["advisory_rank"]),
                }
                for row in options
            ]
            + [
                {"label": row["label"], "status": row["status"], "score_text": "not scored"}
                for row in excluded
            ],
            "assumptions": assumptions,
            "precedent_influence": [f"{item['ref']}: {item['changes']}" for item in precedent],
            "uncertainty_statement": uncertainty,
            "review_context": (
                "Harbor Light review. Regenerated from the stored sensor window. "
                "Not an operational record."
            ),
            "rule_version": spec["rule_version"],
            "precedent_refs": [item["ref"] for item in precedent],
            "chain": " ".join(entry["text"] for entry in chronology),
            "elimination": [
                f"{row['label']} stays off the winning step. "
                + (row["execution_note"] or "It scored below the winner.")
                for row in options
                if row["id"] != options[0]["id"]
            ]
            + [
                f"{row['label']} is unavailable. {row['reason']}"
                for row in excluded
            ],
            "prerequisites": _prerequisites(options[0]["id"], limited),
            "human_approval": (
                "A person approves the next step. This software does not control equipment."
            ),
            "live_rescore": LIVE_RESCORE,
            "score_basis": (
                "The advisory score uses five terms: urgency, feasibility, "
                "consequence reduction, execution burden, and uncertainty penalty. "
                f"The leading score is {options[0]['advisory_rank']}."
            ),
            "delay_effect": delay_model["statement"],
            "bounded_rationale": bounded["statement"],
            "marine_impact": marine_view["ranking_effect"],
        },
        "incident_package": {
            "anomaly_summary": (
                f"Severity {scenario['severity']}. "
                + (
                    "Matched rules: " + ", ".join(fired) + "."
                    if fired
                    else "No demonstration rule matched."
                )
            ),
            "location": _location(scenario, point, vertex_equal, segment),
            "evidence_for": evidence_for,
            "evidence_against": evidence_against,
            "evidence_missing": evidence_missing,
            "hypotheses": [
                {"name": row["name"], "advisory_rank": row["advisory_rank"]}
                for row in hypotheses
            ],
            "options": [
                {
                    "label": row["label"],
                    "status": row["status"],
                    "advisory_rank": row["advisory_rank"],
                }
                for row in options
            ],
            "recommendation": next_step,
            "uncertainty": uncertainty,
            "consequence_proxy": proxy_statement,
            "delay_pathway": [
                f"{step['label']}: exposure {step['exposure_band']}, proxy {step['proxy_band']}."
                for step in delay_pathway
            ],
            "marine_summary": marine_view["ranking_effect"],
            "precedent_refs": [item["ref"] for item in precedent],
            "human_approval": (
                "A person approves the next step. This software does not control equipment."
            ),
            "live_rescore": LIVE_RESCORE,
            "rule_version": spec["rule_version"],
            "bounded_impact": bounded["statement"],
            "precedent_influence": influence["framing"],
            "option_comparison": [
                (
                    f"{row['label']}. Feasibility {row['comparison']['feasibility']}. "
                    f"Prerequisite burden {row['comparison']['prerequisite_burden']}. "
                    f"{row['why_not_leading']}"
                )
                for row in options
            ],
            "marine_notes": " ".join(marine_view["readiness"]),
            "prerequisites": _prerequisites(options[0]["id"], limited),
            "audit_summary": " ".join(entry["text"] for entry in chronology),
            "stream_session": stream["session_id"],
            "triggering_readings": [
                f"{item['timestamp']} {item['metric']} {item['value']} {item['unit']}"
                for item in stream["readings"]
                if item["timestamp"] == stream["frames"][-1]["timestamp"]
            ],
            "normalized_observations": stream["observations"],
            "anomaly_events": [
                f"{item['timestamp']} {', '.join(item['rules'])}. {item['reason']}"
                for item in stream["anomalies"]
            ],
            "hazard_history": stream["hazard_history"],
            "case_updates": stream["case_updates"],
            "action_history": stream["action_history"],
            "corroboration_summary": stream["corroboration_summary"],
            "missing_evidence_summary": stream["missing_evidence_summary"],
            "readiness_stances": [
                f"{frame['step']}: {frame['readiness_stance']}. {frame['readiness_detail']}"
                for frame in stream["frames"]
            ],
            "recommendation_rationales": [
                (
                    f"{frame['step']}: {frame['why_action']} {frame['why_not_stabilize']} "
                    f"{frame['why_not_mobilize']} {frame['why_derate']}"
                )
                for frame in stream["frames"]
            ],
        },
        "chronology": chronology,
        "precedent": precedent,
    }
