export const NOT_STORED = "Not stored.";
export const NOT_CALCULATED = "Not calculated.";
export const APPROVAL_SENTENCE =
  "A person approves the next step. This software does not control equipment.";
export const NO_OVERRIDE = "Not stored. No override is recorded.";
export const NO_REVIEWER = "Not stored. No reviewer is recorded.";

export function storedText(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return NOT_STORED;
  return value;
}

function storedBand(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `Band ${value}.` : null;
}

function storedParts(parts: Array<string | null>): string {
  const kept = parts.filter((part): part is string => part != null && part !== NOT_STORED);
  return kept.length > 0 ? kept.join(" ") : NOT_CALCULATED;
}

export function suggestedStepSentence(step: string, score: number | string): string {
  return `Suggested step: ${step} at advisory score ${score}.`;
}

export type EvidenceNote = { source: string; text: string };

export type CaseSlice = {
  ref: string;
  severity: string;
  next_step: string;
  evidence_for: EvidenceNote[];
  evidence_against: EvidenceNote[];
  evidence_missing: EvidenceNote[];
  hypotheses: {
    name: string;
    advisory_rank: number;
    support_score: number;
    conflict_penalty: number;
    missing_penalty: number;
    support: string;
    conflict: string;
    explanation: string;
  }[];
  options: {
    id: string;
    label: string;
    status: string;
    advisory_rank: number;
    components: {
      urgency: number;
      feasibility: number;
      consequence_reduction: number;
      execution_burden: number;
      uncertainty_penalty: number;
    };
    comparison: { downtime_pressure: string };
    rationale: string;
    why_not_leading: string;
  }[];
  excluded_options: { id: string; label: string; status: string; reason: string }[];
  marine: {
    vessel_readiness: string;
    weather_window: string;
    spare_readiness: string;
    inspection_feasibility: string;
    mobilization_lead_time: string;
    readiness: string[];
    scores: {
      vessel: number;
      weather: number;
      spare: number;
      inspection: number;
      mobilization_lead: number;
    };
  };
  audit: {
    why_it_won: string;
    assumptions: string[];
    rule_version: string;
    human_approval: string;
    rationale: string;
  };
  context?: string;
  opened?: string;
  location_text?: string;
  chronology: { order: string; text: string }[];
  stream: {
    provenance: string;
    action_history: string[];
    missing_evidence_summary: string;
  };
  incident_package: {
    rule_version: string;
    missing_evidence_summary: string;
    corroboration_summary: string;
    anomaly_summary?: string;
  };
  consequence_exposure?: string;
  consequence_model?: {
    service_impact?: number;
    delay_sensitivity?: number;
    exposure_band?: string;
  } | null;
  bounded_impact?: {
    delay_sensitivity: string;
  } | null;
  delay_pathway?: {
    label: string;
    exposure_band: string;
    bounded_outlook: string;
  }[];
  prerequisites?: string;
};

export type TimelineEvent = { id: string; kind: string; summary: string };

export type ResponseCaseInput = {
  requestedCaseId: string;
  storedCaseId: string | null;
  alertRef: string | null;
  expectedRef: string;
  routeName: string | null;
  review: CaseSlice | null;
  timeline: TimelineEvent[];
};

export type ReadinessBand = {
  label: string;
  detail: string;
  state: "Satisfied." | "Blocks immediate action.";
};

export type ResponseCaseView = {
  ref: string;
  severity: string;
  routeName: string;
  suggestedStep: string;
  advisoryScore: string;
  suggestedSentence: string;
  whyItLeads: string;
  assumptions: string[];
  approvalSentence: string;
  bands: ReadinessBand[];
  blocked: ReadinessBand[];
  blockerSentences: string[];
  casePrerequisites: string;
  readinessLines: string[];
  supports: EvidenceNote[];
  conflicts: EvidenceNote[];
  missing: EvidenceNote[];
  evidence: {
    id: string;
    kind: string;
    summary: string;
    source: string;
    timestamp: string;
    segment: string;
    severity: string;
    provenance: string;
    stance: string;
  }[];
  hypotheses: {
    name: string;
    leading: boolean;
    advisoryRank: number;
    supportScore: number;
    conflictPenalty: number;
    missingPenalty: number;
    explanation: string;
    support: string;
    conflict: string;
    missingNote: string;
  }[];
  optionColumns: { id: string; label: string; standing: string; suggested: boolean }[];
  optionRows: { name: string; cells: string[] }[];
  optionPrerequisites: {
    label: string;
    satisfied: string;
    missing: string;
    blocking: string;
    notCalculated: string;
  }[];
  gated: { label: string; reason: string }[];
  consequence: {
    serviceExposure: string;
    delaySensitivity: string;
    reduction: string;
    unknown: string;
    overTime: string[];
  };
  pack: {
    caseReference: string;
    recordId: string;
    ruleVersion: string;
    leadingHypothesis: string;
    suggestedSentence: string;
    missingSummary: string;
    provenance: string;
    chronologySummary: string;
    assumptions: string;
    exportFile: string;
    sections: { label: string; columns: string[]; rows: { key: string; cells: string[] }[] }[];
  };
  handoff: string;
  handoffContract: {
    unavailable: string;
    rows: { key: string; cells: string[] }[];
  };
  audit: {
    ruleVersion: string;
    provenance: string;
    corroboration: string;
    trace: string[];
    overrides: string;
    reviewers: string;
    missingSummary: string;
    chronology: { order: string; text: string }[];
    caseChanges: string[];
  };
};

function bandState(score: number, higherIsBetter: boolean): ReadinessBand["state"] {
  const satisfied = higherIsBetter ? score >= 2 : score <= 1;
  return satisfied ? "Satisfied." : "Blocks immediate action.";
}

export function blockerSentence(band: ReadinessBand): string {
  return `${band.label}. ${band.detail} ${band.state}`;
}

function standing(label: string, suggested: string, status: string): string {
  if (label === suggested) return "Suggested step";
  if (status === "unavailable") return "Gated";
  return "Below the suggested step";
}

function notes(items: EvidenceNote[] | null | undefined): EvidenceNote[] {
  if (!items) return [];
  return items.filter((item) => item.text.trim() !== "");
}

function evidenceRows(items: EvidenceNote[]): { key: string; cells: string[] }[] {
  if (items.length === 0) return [{ key: "empty", cells: [NOT_STORED, NOT_STORED] }];
  return items.map((item) => ({
    key: `${item.source}:${item.text}`,
    cells: [storedText(item.source), item.text],
  }));
}

function orderedRows(lines: string[]): { key: string; cells: string[] }[] {
  if (lines.length === 0) return [{ key: "empty", cells: [NOT_STORED, NOT_STORED] }];
  return lines.map((line, index) => ({
    key: `${index}-${line}`,
    cells: [String(index + 1), line],
  }));
}

export function responseCaseView(input: ResponseCaseInput | null): ResponseCaseView | null {
  if (!input?.review) return null;
  if (!input.storedCaseId || input.storedCaseId !== input.requestedCaseId) return null;
  if (!input.alertRef || input.alertRef !== input.expectedRef) return null;
  if (input.review.ref !== input.expectedRef) return null;

  const review = input.review;
  const winner =
    review.options.find((option) => option.label === review.next_step) ?? review.options[0] ?? null;
  const suggestedStep = storedText(review.next_step);
  const advisoryScore = winner ? String(winner.advisory_rank) : "not stored";
  const routeName = storedText(input.routeName);
  const missing = notes(review.evidence_missing);
  const missingNote =
    missing.length > 0
      ? missing.map((item) => `${item.source}. ${item.text}`).join(" ")
      : NOT_STORED;

  const bands: ReadinessBand[] = [
    {
      label: "Vessel",
      detail: storedText(review.marine.vessel_readiness),
      state: bandState(review.marine.scores.vessel, true),
    },
    {
      label: "Weather window",
      detail: storedText(review.marine.weather_window),
      state: bandState(review.marine.scores.weather, true),
    },
    {
      label: "Spares",
      detail: storedText(review.marine.spare_readiness),
      state: bandState(review.marine.scores.spare, true),
    },
    {
      label: "Inspection",
      detail: storedText(review.marine.inspection_feasibility),
      state: bandState(review.marine.scores.inspection, true),
    },
    {
      label: "Lead time",
      detail: storedText(review.marine.mobilization_lead_time),
      state: bandState(review.marine.scores.mobilization_lead, false),
    },
  ];

  const optionColumns = review.options.map((option) => ({
    id: option.id,
    label: option.label,
    standing: standing(option.label, review.next_step, option.status),
    suggested: option.label === review.next_step,
  }));
  const cell = (read: (option: CaseSlice["options"][number]) => string) =>
    review.options.map((option) => storedText(read(option)));
  const optionRows = [
    { name: "Status", cells: cell((option) => option.status) },
    { name: "Urgency", cells: cell((option) => String(option.components.urgency)) },
    { name: "Feasibility", cells: cell((option) => String(option.components.feasibility)) },
    {
      name: "Consequence reduction",
      cells: cell((option) => String(option.components.consequence_reduction)),
    },
    { name: "Expected impact", cells: cell((option) => option.comparison.downtime_pressure) },
    {
      name: "Execution burden",
      cells: cell((option) => String(option.components.execution_burden)),
    },
    {
      name: "Uncertainty penalty",
      cells: cell((option) => String(option.components.uncertainty_penalty)),
    },
    { name: "Advisory score", cells: cell((option) => String(option.advisory_rank)) },
    { name: "Assumptions", cells: cell((option) => option.rationale) },
    { name: "Why", cells: cell((option) => option.why_not_leading) },
    { name: "Cost", cells: review.options.map(() => "Not calculated.") },
    { name: "Weather", cells: review.options.map(() => "Not calculated.") },
  ];

  const chronology = review.chronology.filter((entry) => entry.text.trim() !== "");
  const trace = [
    ...chronology.map((entry) => entry.text),
    ...review.stream.action_history.filter((line) => line.trim() !== ""),
    storedText(review.audit.why_it_won),
  ];
  const assumptions = review.audit.assumptions.filter((line) => line.trim() !== "");
  const blocked = bands.filter((item) => item.state === "Blocks immediate action.");
  const satisfied = bands.filter((item) => item.state === "Satisfied.");
  const blockerSentences = blocked.map(blockerSentence);
  const satisfiedSentence =
    satisfied.length > 0 ? satisfied.map(blockerSentence).join(" ") : "Not stored.";
  const blockingSentence =
    blockerSentences.length > 0
      ? blockerSentences.join(" ")
      : "No stored band blocks immediate action.";
  const missingSentence = missingNote;
  const notCalculated = "Crew, ROV, and a weather forecast are not calculated.";
  const model = review.consequence_model ?? null;
  const storedDelay = storedText(review.bounded_impact?.delay_sensitivity);
  const serviceExposure = model
    ? storedParts([
        storedBand(model.service_impact),
        storedText(model.exposure_band),
        storedText(review.consequence_exposure),
      ])
    : NOT_CALCULATED;
  const delaySensitivity =
    storedDelay !== NOT_STORED
      ? storedDelay
      : (storedBand(model?.delay_sensitivity) ?? NOT_CALCULATED);
  const reduction =
    winner && Number.isFinite(winner.components.consequence_reduction)
      ? `Stored consequence-reduction term ${winner.components.consequence_reduction} for ${suggestedStep}. This is not a forecast.`
      : NOT_CALCULATED;
  const overTime = (review.delay_pathway ?? [])
    .filter((step) => step.label.trim() !== "")
    .map(
      (step) =>
        `${step.label}. ${storedText(step.exposure_band)} ${storedText(step.bounded_outlook)}`,
    );
  const ruleVersion = storedText(review.audit.rule_version || review.incident_package.rule_version);
  const provenance = storedText(review.stream.provenance);
  const missingSummary = storedText(
    review.incident_package.missing_evidence_summary || review.stream.missing_evidence_summary,
  );
  const chronologySummary =
    chronology.length > 0 ? chronology.map((entry) => entry.text).join(" ") : NOT_STORED;
  const suggestedSentence = suggestedStepSentence(suggestedStep, advisoryScore);
  const approvalSentence =
    storedText(review.audit.human_approval) === NOT_STORED
      ? APPROVAL_SENTENCE
      : review.audit.human_approval;
  const assumptionText = assumptions.length > 0 ? assumptions.join(" ") : NOT_STORED;
  const leading = review.hypotheses[0];
  const caseSummary = storedParts([
    review.ref,
    `Severity ${storedText(review.severity)}.`,
    routeName,
    storedText(review.context),
    storedText(review.opened),
  ]);
  const traceLines = trace.length > 0 ? trace : [NOT_STORED];
  const handoff =
    "Informational only. This does not send a handoff. No CMMS, planner, or incident-record destination is stored.";
  const handoffUnavailable =
    "Send handoff is unavailable. No destination is stored, and this preview does not send a handoff, create a work order, or change the case.";
  const packSections = [
    {
      label: "Case summary",
      columns: ["Category", "Stored detail"],
      rows: [{ key: "summary", cells: ["Summary", caseSummary] }],
    },
    {
      label: "Anomaly summary",
      columns: ["Category", "Stored detail"],
      rows: [
        { key: "anomaly", cells: ["Anomaly", storedText(review.incident_package.anomaly_summary)] },
        { key: "location", cells: ["Location", storedText(review.location_text)] },
      ],
    },
    {
      label: "Leading hypothesis",
      columns: ["Category", "Stored detail"],
      rows: [
        { key: "name", cells: ["Leading hypothesis", storedText(leading?.name)] },
        { key: "why", cells: ["Why this rank", storedText(leading?.explanation)] },
      ],
    },
    {
      label: "Suggested step",
      columns: ["Category", "Stored detail"],
      rows: [
        { key: "step", cells: ["Suggested step", suggestedSentence] },
        { key: "score", cells: ["Advisory score", advisoryScore] },
      ],
    },
    {
      label: "Supporting evidence",
      columns: ["Source", "Statement"],
      rows: evidenceRows(notes(review.evidence_for)),
    },
    {
      label: "Conflicting evidence",
      columns: ["Source", "Statement"],
      rows: evidenceRows(notes(review.evidence_against)),
    },
    {
      label: "Missing evidence",
      columns: ["Source", "Statement"],
      rows: evidenceRows(missing),
    },
    {
      label: "Feasibility bands",
      columns: ["Factor", "Stored statement"],
      rows: bands.map((band) => ({
        key: band.label,
        cells: [band.label, blockerSentence(band)],
      })),
    },
    {
      label: "Assumptions",
      columns: ["Assumption"],
      rows:
        assumptions.length > 0
          ? assumptions.map((line, index) => ({ key: `${index}-${line}`, cells: [line] }))
          : [{ key: "assumptions", cells: [NOT_STORED] }],
    },
    {
      label: "Rule version",
      columns: ["Category", "Stored detail"],
      rows: [
        { key: "rule", cells: ["Rule version", ruleVersion] },
        { key: "model", cells: ["Model version", NOT_STORED] },
      ],
    },
    {
      label: "Provenance summary",
      columns: ["Category", "Stored detail"],
      rows: [{ key: "provenance", cells: ["Provenance", provenance] }],
    },
    {
      label: "Decision trace",
      columns: ["Order", "Entry"],
      rows: orderedRows(traceLines),
    },
    {
      label: "Case chronology",
      columns: ["Order", "Entry"],
      rows: orderedRows(chronology.map((entry) => entry.text)),
    },
    {
      label: "Approval",
      columns: ["Category", "Stored detail"],
      rows: [{ key: "approval", cells: ["Approval", approvalSentence] }],
    },
    {
      label: "Export status",
      columns: ["Category", "Stored detail"],
      rows: [
        { key: "file", cells: ["Export file", NOT_STORED] },
        { key: "generated", cells: ["Generated file", NOT_CALCULATED] },
      ],
    },
  ];

  return {
    ref: review.ref,
    severity: storedText(review.severity),
    routeName,
    suggestedStep,
    advisoryScore,
    suggestedSentence,
    whyItLeads: storedText(review.audit.why_it_won),
    assumptions: assumptions.length > 0 ? assumptions : [NOT_STORED],
    approvalSentence,
    bands,
    blocked,
    blockerSentences,
    casePrerequisites: storedText(review.prerequisites),
    readinessLines: review.marine.readiness.filter((line) => line.trim() !== ""),
    supports: notes(review.evidence_for),
    conflicts: notes(review.evidence_against),
    missing,
    evidence: input.timeline.map((event) => ({
      id: event.id,
      kind: event.kind,
      summary: event.summary,
      source: storedText(event.kind),
      timestamp: NOT_STORED,
      segment: routeName,
      severity: storedText(review.severity),
      provenance: storedText(event.summary),
      stance: "Supports the stored case record.",
    })),
    hypotheses: review.hypotheses.map((hypothesis, index) => ({
      name: hypothesis.name,
      leading: index === 0,
      advisoryRank: hypothesis.advisory_rank,
      supportScore: hypothesis.support_score,
      conflictPenalty: hypothesis.conflict_penalty,
      missingPenalty: hypothesis.missing_penalty,
      explanation: storedText(hypothesis.explanation),
      support: storedText(hypothesis.support),
      conflict: storedText(hypothesis.conflict),
      missingNote: `Missing penalty ${hypothesis.missing_penalty}. The missing count is the same for every explanation. ${missingNote}`,
    })),
    optionColumns,
    optionRows,
    optionPrerequisites: review.options.map((option) => ({
      label: option.label,
      satisfied: satisfiedSentence,
      missing: missingSentence,
      blocking: blockingSentence,
      notCalculated,
    })),
    gated: review.excluded_options
      .filter((option) => option.status === "unavailable" || option.reason.trim() !== "")
      .map((option) => ({ label: option.label, reason: storedText(option.reason) })),
    audit: {
      ruleVersion,
      provenance,
      corroboration: storedText(review.incident_package.corroboration_summary),
      trace: trace.length > 0 ? trace : [NOT_STORED],
      overrides: NO_OVERRIDE,
      reviewers: NO_REVIEWER,
      missingSummary,
      chronology,
      caseChanges:
        input.timeline.length > 0
          ? input.timeline.map((event) => `${event.kind}. ${event.summary}`)
          : [NOT_STORED],
    },
    consequence: {
      serviceExposure,
      delaySensitivity,
      reduction,
      unknown: missingSentence,
      overTime: overTime.length > 0 ? overTime : [NOT_CALCULATED],
    },
    pack: {
      caseReference: review.ref,
      recordId: storedText(input.requestedCaseId),
      ruleVersion,
      leadingHypothesis: storedText(review.hypotheses[0]?.name),
      suggestedSentence,
      missingSummary,
      provenance,
      chronologySummary,
      assumptions: assumptionText,
      exportFile: NOT_STORED,
      sections: packSections,
    },
    handoff,
    handoffContract: {
      unavailable: handoffUnavailable,
      rows: [
        { key: "target", cells: ["Target system type", NOT_STORED] },
        { key: "action", cells: ["Suggested action", suggestedSentence] },
        {
          key: "case",
          cells: ["Case identifier", `${review.ref}. Record ${storedText(input.requestedCaseId)}.`],
        },
        { key: "blocking", cells: ["Blocking constraints", blockingSentence] },
        { key: "assumptions", cells: ["Assumptions", assumptionText] },
        { key: "provenance", cells: ["Provenance reference", provenance] },
        { key: "audit", cells: ["Audit note", `${ruleVersion}. ${approvalSentence}`] },
      ],
    },
  };
}
