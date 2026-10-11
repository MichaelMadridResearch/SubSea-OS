"""Deterministic Harbor Light telemetry replay.

Frames come from the stored telemetry rows. Hazard stage is advisory context.
It is not an input to the five-term score.
"""

SESSION_ID = "harbor-light-replay-1"
ABSENT_EVIDENCE = (
    "Strain is absent. Weather measurement is absent. "
    "Movement is stored on the case, not on this replay row."
)
PROVENANCE = "Harbor Light fixture replay. Not a live feed."
STAGES = ("Normal", "Watch", "Concern", "Hazard", "Intervention-critical")
METRICS = (
    ("thermal_index", "Temperature context", "stored thermal index"),
    ("load_index", "Load context", "stored load index"),
    ("acoustic_index", "Acoustic signal", "stored acoustic index"),
    ("insulation_decline_count", "Insulation trend", "stored decline count"),
)


def build_stream(
    scenario: dict,
    thresholds: dict,
    rules,
    segment_label: str,
    next_step: str,
    score: int,
) -> dict:
    signals = scenario["signals"]
    delay_band = scenario["consequence_inputs"]["delay_band"]
    stage = "Normal"
    frames = []
    readings = []
    observations = []
    anomalies = []
    hazard_history = ["Normal. Replay has not applied a stored row."]
    case_updates = []
    timeline = []
    opened = False
    previous = None
    rows = scenario["telemetry"]
    derate_available = (
        "thermal_hotspot" in rules(signals, thresholds)
        and signals["load_index"] >= thresholds["load_index"]
    )
    for index, row in enumerate(rows):
        last = index == len(rows) - 1
        window = dict(signals)
        for key, _name, _unit in METRICS:
            window[key] = row[key]
        if last:
            window = dict(signals)
        elif index == 0:
            window["persistence"] = False
        else:
            window["persistence"] = row["thermal_index"] >= previous["thermal_index"]
        fired = rules(window, thresholds)
        stage, reason = _advance(stage, fired, delay_band)
        stamp = f"Reading {row['step']}"
        frame_readings = []
        for key, name, unit in METRICS:
            reading = {
                "timestamp": stamp,
                "segment_id": scenario["segment_id"],
                "metric": name,
                "value": row[key],
                "unit": unit,
                "provenance": PROVENANCE,
            }
            frame_readings.append(reading)
            readings.append(reading)
            observations.append(
                f"{stamp}. {name} {row[key]} {unit} on {segment_label}."
            )
        rise = _rise(previous, row)
        contributed = _contributed(row, fired)
        evidence_state, evidence_detail = _evidence(row, signals, thresholds, fired)
        prior_stage = "Normal" if previous is None else frames[-1]["hazard_stage"]
        prior_fired = previous is not None and bool(frames[-1]["fired"])
        delay_pressure = _delay_pressure(index, delay_band, stage, prior_stage, bool(rise))
        opening = bool(fired) and not opened
        readiness_stance, readiness_detail = _readiness(scenario["execution"], opened or opening)
        progress = _progress(fired, opening, stage)
        changed = _changed(
            previous is None, rise, bool(fired), prior_fired, prior_stage, stage, opening
        )
        why = _why(next_step, score, evidence_state, readiness_stance, derate_available)
        if fired and not opened:
            opened = True
            case_updates.append(
                f"{stamp}. Response case opened. Stored rules: {', '.join(fired)}."
            )
        elif opened:
            case_updates.append(f"{stamp}. Response case updated from the stored row.")
        if fired:
            anomalies.append(
                {
                    "timestamp": stamp,
                    "rules": list(fired),
                    "reason": reason,
                    "contributed": contributed,
                }
            )
            anomaly_text = "Anomaly: " + ", ".join(fired) + "."
        else:
            anomaly_text = "Weak signal. No stored threshold is crossed."
        hazard_history.append(f"{stamp}. {stage}. {reason}")
        text = (
            f"{stamp}. Raw readings on {segment_label}. {anomaly_text} "
            f"Hazard stage {stage}. {reason}"
        )
        if rise:
            text = f"{text} {rise}"
        text = f"{text} {changed}"
        timeline.append({"order": str(index + 1), "text": text})
        frames.append(
            {
                "step": row["step"],
                "timestamp": stamp,
                "hazard_stage": stage,
                "reason": reason,
                "fired": list(fired),
                "case_open": opened,
                "readings": frame_readings,
                "evidence_state": evidence_state,
                "evidence_detail": evidence_detail,
                "delay_pressure": delay_pressure,
                "readiness_stance": readiness_stance,
                "readiness_detail": readiness_detail,
                "progress": progress,
                "changed": changed,
                "why_action": why["action"],
                "why_not_stabilize": why["stabilize"],
                "why_not_mobilize": why["mobilize"],
                "why_derate": why["derate"],
            }
        )
        previous = row
    action = (
        f"Preserved advisory step: {next_step}. Advisory score {score}. "
        "The stream does not replace the five-term score."
    )
    timeline.append(
        {
            "order": str(len(timeline) + 1),
            "text": (
                f"Suggested action. {action} "
                "A person approves the next step. This software does not control equipment."
            ),
        }
    )
    return {
        "session_id": SESSION_ID,
        "segment_id": scenario["segment_id"],
        "provenance": PROVENANCE,
        "strain": "Not calculated. No strain record is stored.",
        "weather": "Not calculated. No weather measurement is stored.",
        "readiness": _readiness_panel(scenario),
        "corroboration_summary": frames[-1]["evidence_detail"],
        "missing_evidence_summary": ABSENT_EVIDENCE,
        "hazard_stage": stage,
        "case_open": opened,
        "frames": frames,
        "readings": readings,
        "observations": observations,
        "anomalies": anomalies,
        "hazard_history": hazard_history,
        "case_updates": case_updates,
        "action_history": [action],
        "timeline": timeline,
    }


def _advance(current: str, fired: list[str], delay_band: int) -> tuple[str, str]:
    if not fired:
        if current == "Normal":
            return "Watch", "A stored reading is present. No stored threshold is crossed."
        return current, "The stored reading stays below the threshold."
    steps = 1
    reason = "A stored threshold is crossed."
    if len(fired) >= 2 and delay_band >= 2:
        steps = 2
        reason = "Two stored rules match and the delay band is at least 2."
    elif delay_band >= 2 and current in {"Concern", "Hazard"}:
        steps = 2
        reason = "The rule persists and the delay band is at least 2."
    index = STAGES.index(current)
    stage = STAGES[min(len(STAGES) - 1, index + steps)]
    return stage, reason + " This stage does not change the advisory score."


def _rise(previous: dict | None, row: dict) -> str:
    if previous is None:
        return ""
    rises = []
    for key, name, _unit in METRICS:
        if row[key] > previous[key]:
            rises.append(f"{name} rose from {previous[key]} to {row[key]}.")
    return " ".join(rises)


def _evidence(row: dict, signals: dict, thresholds: dict, fired: list[str]) -> tuple[str, str]:
    support = []
    if "thermal_hotspot" in fired:
        support.append("thermal_hotspot is supported by Temperature context and Load context.")
    elif (
        row["thermal_index"] >= thresholds["thermal_index"]
        or row["load_index"] >= thresholds["load_index"]
    ):
        support.append("thermal_hotspot is incomplete. One stored index stays under the threshold.")
    if "insulation_trend" in fired:
        support.append("insulation_trend is supported by Insulation trend alone.")
    if "external_disturbance" in fired:
        support.append(
            "external_disturbance is supported by Acoustic signal and the stored vessel window."
        )
    elif row["acoustic_index"] >= thresholds["acoustic_index"] and not signals["vessel_window"]:
        support.append(
            "external_disturbance is incomplete. The stored vessel window is closed."
        )
    conflicts = []
    if signals["survey_burial"] == "intact" and "thermal_hotspot" in fired:
        conflicts.append("The stored survey describes burial as intact.")
    absent = ABSENT_EVIDENCE
    if conflicts:
        state = "conflicting"
    elif len(fired) >= 2 or "thermal_hotspot" in fired or "external_disturbance" in fired:
        state = "corroborated"
    elif len(fired) == 1:
        state = "single-signal"
    else:
        state = "incomplete"
    detail = " ".join(support) if support else "No stored class is fully supported."
    if conflicts:
        detail = f"{detail} {' '.join(conflicts)}"
    return state, f"{state}. {detail} {absent}"


def _delay_pressure(
    index: int, delay_band: int, stage: str, prior_stage: str, rose: bool
) -> str:
    if index == 0:
        kind = "Weak early concern."
    elif stage != prior_stage:
        kind = "Urgency without score change."
    elif rose:
        kind = "A stored index rose. Consequence growth stays on the stored bands."
    else:
        kind = "Persistent concern."
    return (
        f"{kind} Stored delay band {delay_band}. "
        "The bounded index uses the stored outage, service, delay, and lead bands. "
        "It does not change between replay frames. "
        "Delay pressure is advisory context, not a score term."
    )


def _readiness(execution: dict, case_open: bool) -> tuple[str, str]:
    if not case_open:
        return "not actionable yet", "No stored rule has opened the case."
    vessel = execution["vessel"]
    weather = execution["weather"]
    spare = execution["spare"]
    if spare == 0 and execution["mobilization_lead"] >= 2 and vessel < 2:
        return "delayed", "Spare band is 0 and the vessel band is below 2."
    if spare == 0 or vessel < 2 or weather < 2 or execution["prerequisites"] < 2:
        return "constrained", "A stored readiness band is below 2 or no spare is staged."
    return "ready", "Stored vessel, weather, spare, and prerequisite bands are at least 2."


def _readiness_panel(scenario: dict) -> dict:
    execution = scenario["execution"]
    marine = scenario["marine"]
    return {
        "vessel": f"Vessel readiness. Band {execution['vessel']}. {marine['vessel_readiness']}",
        "spare": f"Spare readiness. Band {execution['spare']}. {marine['spare_readiness']}",
        "permit": f"Permit dependency. {execution['permit_delay']}",
        "mobilization": (
            f"Mobilization lead burden. Band {execution['mobilization_lead']}. "
            f"{execution['mobilization_lead_time']}"
        ),
        "weather": marine["weather_window"],
        "crew": "Not calculated. No crew or tool record is stored.",
    }


def _progress(fired: list[str], opening: bool, stage: str) -> str:
    if not fired:
        return "monitoring only"
    if opening:
        return "case opened"
    if stage == "Intervention-critical":
        return "intervention-critical review"
    return "case updated"


def _changed(
    first: bool,
    rise: str,
    fired: bool,
    prior_fired: bool,
    prior_stage: str,
    stage: str,
    opening: bool,
) -> str:
    parts = ["New reading."]
    if rise:
        parts.append(rise)
    if fired and not prior_fired:
        parts.append("New anomaly evidence.")
    if stage != prior_stage:
        parts.append(f"Stage transition from {prior_stage} to {stage}.")
    if opening:
        parts.append("Case open event.")
        if stage == "Concern":
            parts.append("Anomaly under review.")
    elif fired:
        parts.append("Case update event.")
    elif not first:
        parts.append("No new anomaly evidence.")
    parts.append("The preserved recommendation stays in place.")
    return " ".join(parts)


def _why(
    next_step: str,
    score: int,
    evidence_state: str,
    readiness_stance: str,
    derate_available: bool,
) -> dict:
    action = (
        f"The preserved step stays {next_step} at advisory score {score}. "
        f"This frame is {evidence_state}. Readiness is {readiness_stance}. "
        "The completed-window score is not recalculated."
    )
    stabilize = (
        "Temporary stabilization is not leading. "
        "It stays below the preserved score and still needs a person."
    )
    mobilize = (
        "Repair mobilization is not leading. "
        "The stored spare band keeps it behind the preserved step."
    )
    if derate_available:
        derate = (
            "A derate review is available. It uses the completed window, "
            "where the thermal hotspot rule matches and the load index meets the threshold. "
            "It is not the preserved step."
        )
    else:
        derate = (
            "A derate review is not available. The completed window did not match "
            "the thermal hotspot rule and the stored load threshold together."
        )
    return {
        "action": action,
        "stabilize": stabilize,
        "mobilize": mobilize,
        "derate": derate,
    }


def _contributed(row: dict, fired: list[str]) -> list[str]:
    lines = []
    if "thermal_hotspot" in fired:
        lines.append(
            f"Temperature context {row['thermal_index']} and load context {row['load_index']}."
        )
    if "external_disturbance" in fired:
        lines.append(f"Acoustic signal {row['acoustic_index']} with the stored vessel window.")
    if "insulation_trend" in fired:
        lines.append(f"Insulation trend {row['insulation_decline_count']}.")
    if "exposure_movement" in fired:
        lines.append("Exposure and movement used the stored signals.")
    return lines
