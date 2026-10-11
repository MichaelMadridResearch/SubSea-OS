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

const UNSUPPORTED_FIELDS = [
  "Vessel",
  "ROV",
  "Operation",
  "Mobilization buffer",
  "Crew",
  "Port departure",
] as const;

export default function FeasibilityPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";
  const session = useWorkspace("required");
  const record = useCase(session.token, caseId);
  const openCases = openCaseCount(session.workspace);
  const pending = session.loading || (Boolean(session.token) && record.loading);
  const sentence = record.error || (!session.workspace ? session.error : "");
  const feasibility = fictionalCaseBlock(session.workspace?.display?.feasibility);
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
            <CaseTabs caseId={caseId} current="feasibility" />
          </header>
          <div className="panel-heading feasibility-heading">
            <div>
              <h2>Marine-operation feasibility</h2>
              {storedAlert ? <p>{STORED_ALERT_REF}</p> : null}
              {feasibility ? <p className="meta">{feasibility.assumption}</p> : null}
              {feasibility ? <p>{feasibility.summary}</p> : null}
            </div>
            <button type="button" className="primary" disabled>
              Send requirements to marine planner
            </button>
          </div>
          <section className="panel">
            <h2>10-day weather and operating windows</h2>
            <p>Not calculated.</p>
          </section>
          <div className="split">
            <section className="panel">
              <h2>Selected candidate window</h2>
              <p>Not calculated.</p>
              <h3>Stored readiness</h3>
              {view ? (
                <CategoryTable
                  label="Stored readiness"
                  columns={["Factor", "Stored detail", "State"]}
                  rows={view.bands.map((band) => ({
                    key: band.label,
                    cells: [band.label, band.detail, band.state],
                  }))}
                />
              ) : (
                <p>Not stored.</p>
              )}
              <h3>Blocking constraints</h3>
              <ul aria-label="Blocking constraints">
                {(view?.blockerSentences ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <ul>
                {(view?.readinessLines ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="meta">
                A band of 0 blocks that part of the work. A band of 2 is satisfied for that stored
                factor. Crew and a weather forecast stay not calculated.
              </p>
            </section>
            <section className="panel">
              <h2>Operation requirements</h2>
              <CategoryTable
                label="Operation requirements"
                columns={["Requirement", "Stored detail"]}
                rows={[
                  ...UNSUPPORTED_FIELDS.map((name) => ({
                    key: name,
                    cells: [name, "Not calculated."],
                  })),
                  {
                    key: "weather-source",
                    cells: ["Weather-source metadata", "Not calculated."],
                  },
                ]}
              />
            </section>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
