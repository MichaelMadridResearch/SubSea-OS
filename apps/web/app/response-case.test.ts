import assert from "node:assert/strict";
import test from "node:test";
import { responseCaseView, type CaseSlice, type ResponseCaseInput, NO_OVERRIDE, NO_REVIEWER, NOT_CALCULATED, NOT_STORED } from "./response-case.ts";

function review(overrides: Partial<CaseSlice> = {}): CaseSlice {
  return {
    ref: "FICTIONAL-ALERT-001",
    severity: "Critical",
    next_step: "Request engineering review",
    evidence_for: [],
    evidence_against: [],
    evidence_missing: [],
    hypotheses: [],
    options: [
      {
        id: "review",
        label: "Request engineering review",
        status: "scored",
        advisory_rank: 12,
        components: {
          urgency: 6,
          feasibility: 4,
          consequence_reduction: 4,
          execution_burden: 2,
          uncertainty_penalty: 0,
        },
        comparison: { downtime_pressure: "High band" },
        rationale: "Stored rationale.",
        why_not_leading: "This is the suggested step.",
      },
    ],
    excluded_options: [],
    marine: {
      vessel_readiness: "Vessel band 2.",
      weather_window: "Weather band 2.",
      spare_readiness: "",
      inspection_feasibility: "Inspection band 1.",
      mobilization_lead_time: "Lead band 2.",
      readiness: [],
      scores: { vessel: 2, weather: 2, spare: 0, inspection: 1, mobilization_lead: 2 },
    },
    audit: {
      why_it_won: "",
      assumptions: [],
      rule_version: "",
      human_approval: "",
      rationale: "",
    },
    chronology: [],
    stream: { provenance: "", action_history: [], missing_evidence_summary: "" },
    incident_package: {
      rule_version: "",
      missing_evidence_summary: "",
      corroboration_summary: "",
    },
    ...overrides,
  };
}

function input(patch: Partial<ResponseCaseInput> = {}): ResponseCaseInput {
  return {
    requestedCaseId: "case-1",
    storedCaseId: "case-1",
    alertRef: "FICTIONAL-ALERT-001",
    expectedRef: "FICTIONAL-ALERT-001",
    routeName: "Harbor Light export route",
    review: review(),
    timeline: [],
    ...patch,
  };
}

test("a missing review or a different case stays null", () => {
  assert.equal(responseCaseView(null), null);
  assert.equal(responseCaseView(input({ review: null })), null);
  assert.equal(responseCaseView(input({ requestedCaseId: "other" })), null);
  assert.equal(responseCaseView(input({ alertRef: null })), null);
});

test("absent fixture fields stay explicit", () => {
  const view = responseCaseView(input());
  assert.ok(view);
  assert.equal(view.whyItLeads, NOT_STORED);
  assert.deepEqual(view.assumptions, [NOT_STORED]);
  assert.equal(view.audit.ruleVersion, NOT_STORED);
  assert.equal(view.audit.provenance, NOT_STORED);
  assert.equal(view.audit.overrides, NO_OVERRIDE);
  assert.equal(view.audit.reviewers, NO_REVIEWER);
  assert.equal(view.audit.missingSummary, NOT_STORED);
  assert.deepEqual(view.audit.caseChanges, [NOT_STORED]);
  assert.equal(view.suggestedSentence, "Suggested step: Request engineering review at advisory score 12.");
  assert.equal(view.bands.find((band) => band.label === "Spares")?.detail, NOT_STORED);
  assert.equal(view.bands.find((band) => band.label === "Spares")?.state, "Blocks immediate action.");
  assert.equal(view.bands.find((band) => band.label === "Vessel")?.state, "Satisfied.");
});

test("stored missing evidence is repeated on the view", () => {
  const view = responseCaseView(
    input({
      review: review({
        evidence_missing: [
          { source: "inspection", text: "No inspection record is stored for this window." },
        ],
        hypotheses: [
          {
            name: "Overheating",
            advisory_rank: 0,
            support_score: 3,
            conflict_penalty: 2,
            missing_penalty: 1,
            support: "Thermal hotspot matched.",
            conflict: "Burial is intact.",
            explanation: "Stored indices match a hotspot.",
          },
        ],
      }),
      timeline: [{ id: "1", kind: "case_opened", summary: "An operator opened a case." }],
    }),
  );
  assert.ok(view);
  assert.equal(view.missing[0]?.text, "No inspection record is stored for this window.");
  assert.match(view.hypotheses[0]?.missingNote ?? "", /No inspection record is stored for this window/);
  assert.match(view.audit.caseChanges[0] ?? "", /case_opened/);
  assert.equal(view.evidence[0]?.timestamp, NOT_STORED);
});

test("consequence, blockers, pack, and handoff stay explicit", () => {
  const absent = responseCaseView(input());
  assert.ok(absent);
  assert.equal(absent.consequence.serviceExposure, NOT_CALCULATED);
  assert.deepEqual(absent.consequence.overTime, [NOT_CALCULATED]);
  assert.equal(absent.pack.exportFile, NOT_STORED);
  assert.match(absent.handoff, /does not send a handoff/);
  assert.equal(absent.suggestedSentence, "Suggested step: Request engineering review at advisory score 12.");
  for (const item of absent.optionPrerequisites) {
    assert.equal(item.blocking, absent.blockerSentences.join(" "));
    assert.match(item.notCalculated, /not calculated/i);
  }

  const stored = responseCaseView(
    input({
      review: review({
        consequence_exposure: "Exposure band: High band.",
        consequence_model: { service_impact: 3, delay_sensitivity: 2, exposure_band: "High band" },
        bounded_impact: { delay_sensitivity: "Waiting keeps the bounded range on the current proxy band." },
        delay_pathway: [{ label: "Now", exposure_band: "High band", bounded_outlook: "Bounded range at this step: High band." }],
        prerequisites: "A person opens the engineering review. No equipment is controlled.",
      }),
    }),
  );
  assert.ok(stored);
  assert.match(stored.consequence.serviceExposure, /Band 3/);
  assert.match(stored.consequence.delaySensitivity, /bounded range/);
  assert.match(stored.consequence.reduction, /consequence-reduction term 4/);
  assert.equal(stored.pack.caseReference, "FICTIONAL-ALERT-001");
  assert.match(stored.casePrerequisites, /No equipment is controlled/);

  const partial = responseCaseView(
    input({
      review: review({
        consequence_model: { exposure_band: "High band" },
      }),
    }),
  );
  assert.ok(partial);
  assert.equal(partial.consequence.serviceExposure, "High band");
  assert.equal(partial.consequence.delaySensitivity, NOT_CALCULATED);
  assert.equal(
    responseCaseView(input({ review: review({ consequence_model: {} }) }))?.consequence
      .serviceExposure,
    NOT_CALCULATED,
  );
});

test("case pack and handoff contract reuse the stored sentences", () => {
  const absent = responseCaseView(input());
  assert.ok(absent);
  const exportStatus = absent.pack.sections.find((section) => section.label === "Export status");
  assert.equal(exportStatus?.rows.find((row) => row.key === "file")?.cells[1], NOT_STORED);
  assert.equal(exportStatus?.rows.find((row) => row.key === "generated")?.cells[1], NOT_CALCULATED);
  assert.equal(
    absent.pack.sections.find((section) => section.label === "Suggested step")?.rows[0]?.cells[1],
    absent.suggestedSentence,
  );
  assert.equal(
    absent.handoffContract.rows.find((row) => row.key === "action")?.cells[1],
    absent.suggestedSentence,
  );
  assert.equal(absent.handoffContract.rows.find((row) => row.key === "target")?.cells[1], NOT_STORED);
  assert.equal(
    absent.handoffContract.rows.find((row) => row.key === "blocking")?.cells[1],
    absent.blockerSentences.join(" "),
  );
  assert.match(absent.handoffContract.unavailable, /does not send a handoff/);
  assert.match(absent.handoffContract.rows.find((row) => row.key === "audit")?.cells[1] ?? "", /does not control equipment/);

  const stored = responseCaseView(
    input({
      review: review({
        context: "Offshore substation on the export segment.",
        location_text: "vertex of the stored route",
        evidence_missing: [
          { source: "inspection", text: "No inspection record is stored for this window." },
        ],
        incident_package: {
          rule_version: "harbor-light-rules-3",
          missing_evidence_summary: "No inspection record is stored for this window.",
          corroboration_summary: "",
          anomaly_summary: "Severity Critical. Matched rules: thermal_hotspot.",
        },
        audit: {
          why_it_won: "Request engineering review has the highest advisory score (12) for the stored bands.",
          assumptions: ["Bands are stored indices."],
          rule_version: "harbor-light-rules-3",
          human_approval: "",
          rationale: "",
        },
        stream: {
          provenance: "Harbor Light fixture replay. Not a live feed.",
          action_history: [],
          missing_evidence_summary: "",
        },
      }),
    }),
  );
  assert.ok(stored);
  assert.match(
    stored.pack.sections.find((section) => section.label === "Case summary")?.rows[0]?.cells[1] ?? "",
    /Offshore substation on the export segment/,
  );
  assert.match(
    stored.pack.sections.find((section) => section.label === "Anomaly summary")?.rows[0]?.cells[1] ?? "",
    /thermal_hotspot/,
  );
  assert.equal(stored.pack.ruleVersion, stored.audit.ruleVersion);
  assert.equal(stored.pack.suggestedSentence, stored.suggestedSentence);
  assert.match(
    stored.pack.sections.find((section) => section.label === "Missing evidence")?.rows[0]?.cells[1] ?? "",
    /No inspection record is stored for this window/,
  );
  assert.equal(
    stored.handoffContract.rows.find((row) => row.key === "provenance")?.cells[1],
    "Harbor Light fixture replay. Not a live feed.",
  );
  assert.equal(
    stored.handoffContract.rows.find((row) => row.key === "action")?.cells[1],
    stored.suggestedSentence,
  );
});
