"use client";

import { useParams } from "next/navigation";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "../../../shell";
import { CategoryTable } from "../../../case-advisory";
import {
  CaseTabs,
  STORED_ALERT_REF,
  StoredQueueMeta,
  fictionalCaseBlock,
  caseResponseView,
  openCaseCount,
  useCase,
  useWorkspace,
} from "../../../workspace";

const EVIDENCE_COLUMNS = ["Supporting", "Conflicting", "Missing"] as const;

function EvidenceColumns() {
  return (
    <CategoryTable
      label="Display evidence categories"
      columns={["Category", "Detail"]}
      rows={EVIDENCE_COLUMNS.map((label) => ({
        key: label,
        cells: [label, "Not calculated."],
      }))}
    />
  );
}

export default function HypothesesPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";
  const session = useWorkspace("required");
  const record = useCase(session.token, caseId);
  const openCases = openCaseCount(session.workspace);
  const pending = session.loading || (Boolean(session.token) && record.loading);
  const sentence = record.error || (!session.workspace ? session.error : "");
  const hypotheses = fictionalCaseBlock(session.workspace?.display?.hypotheses);
  const storedAlert = session.workspace?.alert?.external_ref === STORED_ALERT_REF;
  const view = caseResponseView(session.workspace, caseId, record.detail?.timeline ?? []);

  return (
    <Shell
      farm={session.workspace?.wind_farm_name ?? null}
      openCases={openCases}
      initials={session.workspace ? "OP" : "—"}
      current="cases"
    >
      {pending && !record.detail ? <LoadingStatus /> : null}
      {sentence && !record.detail ? <CriticalMessage sentence={sentence} /> : null}
      {session.workspace && record.detail ? (
        <>
          <header className="case-header">
            <div className="page-heading">
              <div>
                <h1>Case {record.detail.state}</h1>
                <p className="meta">
                  {session.workspace.alert?.external_ref} · {session.workspace.cable_name}
                </p>
                <StoredQueueMeta workspace={session.workspace} />
              </div>
              <button type="button" className="primary" disabled>
                Request engineering review
              </button>
            </div>
            <div className="actions">
              <button type="button" className="secondary" disabled>
                Assign
              </button>
              <button type="button" className="secondary" disabled>
                Add evidence
              </button>
              <button type="button" className="secondary" disabled>
                More
              </button>
            </div>
            <CaseTabs caseId={caseId} current="hypotheses" />
          </header>
          <div className="panel-heading">
            <h2>Competing hypotheses</h2>
            <button type="button" className="secondary" disabled>
              Compare calculations
            </button>
          </div>
          <p className="advisory-strip">
            Rank = support minus conflict minus the missing-evidence penalty. A higher rank means
            more stored readings agree. This is not a chance of failure.
          </p>
          {view ? (
            <>
              <CategoryTable
                label="Ranked explanations"
                columns={[
                  "Explanation",
                  "Advisory rank",
                  "Support",
                  "Conflict penalty",
                  "Missing penalty",
                ]}
                rows={view.hypotheses.map((hypothesis) => ({
                  key: hypothesis.name,
                  className: hypothesis.leading ? "hypothesis-leading" : undefined,
                  cells: [
                    `${hypothesis.leading ? "Leading explanation. " : ""}${hypothesis.name}`,
                    String(hypothesis.advisoryRank),
                    String(hypothesis.supportScore),
                    String(hypothesis.conflictPenalty),
                    String(hypothesis.missingPenalty),
                  ],
                }))}
              />
              <CategoryTable
                label="Supporting evidence"
                columns={["Explanation", "Supporting"]}
                rows={view.hypotheses.map((hypothesis) => ({
                  key: hypothesis.name,
                  className: hypothesis.leading ? "hypothesis-leading" : undefined,
                  cells: [hypothesis.name, hypothesis.support],
                }))}
              />
              <CategoryTable
                label="Conflicting evidence"
                columns={["Explanation", "Conflicting"]}
                rows={view.hypotheses.map((hypothesis) => ({
                  key: hypothesis.name,
                  className: hypothesis.leading ? "hypothesis-leading" : undefined,
                  cells: [hypothesis.name, hypothesis.conflict],
                }))}
              />
              <CategoryTable
                label="Missing evidence"
                columns={["Explanation", "Missing"]}
                rows={view.hypotheses.map((hypothesis) => ({
                  key: hypothesis.name,
                  className: hypothesis.leading ? "hypothesis-leading" : undefined,
                  cells: [hypothesis.name, hypothesis.missingNote],
                }))}
              />
              <CategoryTable
                label="Explanations"
                columns={["Explanation", "Why this rank"]}
                rows={view.hypotheses.map((hypothesis) => ({
                  key: hypothesis.name,
                  className: hypothesis.leading ? "hypothesis-leading" : undefined,
                  cells: [hypothesis.name, hypothesis.explanation],
                }))}
              />
            </>
          ) : (
            <p>Not stored.</p>
          )}
          {storedAlert ? <p>{STORED_ALERT_REF}</p> : null}
          {hypotheses ? <p>{hypotheses.assumption}</p> : null}
          {hypotheses && hypotheses.items.length > 0 ? (
            hypotheses.items.map((item) => (
              <section key={item.id} className="panel">
                <h3>{item.title}</h3>
                <p>{item.statement}</p>
                <p>{item.status}</p>
                <EvidenceColumns />
              </section>
            ))
          ) : (
            <section className="panel">
              <EvidenceColumns />
            </section>
          )}
        </>
      ) : null}
    </Shell>
  );
}
