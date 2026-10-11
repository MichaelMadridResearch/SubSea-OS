"use client";

import { useParams } from "next/navigation";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "../../shell";
import {
  CaseTabs,
  FictionalMap,
  ResponseReviewPanel,
  RouteVertices,
  STORED_ALERT_REF,
  StoredQueueMeta,
  caseResponseView,
  openCaseCount,
  useCase,
  useWorkspace,
} from "../../workspace";
import { ConsequenceSummary } from "../../case-advisory";

export default function CaseOverviewPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";
  const session = useWorkspace("required");
  const record = useCase(session.token, caseId);
  const openCases = openCaseCount(session.workspace);
  const pending = session.loading || (Boolean(session.token) && record.loading);
  const sentence = record.error || (!session.workspace ? session.error : "");
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
            <CaseTabs caseId={caseId} current="overview" />
          </header>
          {view ? <ConsequenceSummary view={view} /> : <p>Not calculated.</p>}
          <div className="split">
            <section className="panel">
              <div className="panel-heading">
                <h2>{session.workspace.cable_name}</h2>
                <p className="meta">Observed location</p>
              </div>
              <FictionalMap
                coordinates={session.workspace.route.coordinates}
                display={session.workspace.display}
                focusMarkerId={
                  session.workspace.response?.active.find((row) => row.ref === STORED_ALERT_REF)
                    ?.marker_id ?? null
                }
              />
              <p>
                {session.workspace.response?.active.find((row) => row.ref === STORED_ALERT_REF)
                  ?.location_text ?? "Not calculated."}
              </p>
              <p className="meta">{session.workspace.route.name}</p>
              {session.workspace.display ? (
                <p className="meta">
                  {session.workspace.display.route_metadata.label}.{" "}
                  {session.workspace.display.route_metadata.name}
                </p>
              ) : null}
              <RouteVertices coordinates={session.workspace.route.coordinates} />
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Current assessment</h2>
              </div>
              <p>Not calculated</p>
            </section>
          </div>
          <ResponseReviewPanel review={session.workspace.response} selectedRef={STORED_ALERT_REF} />
          <div className="split">
            <section className="panel">
              <h2>Temperature and cable load</h2>
              <p>Not calculated</p>
            </section>
            <section className="panel">
              <h2>Evidence timeline</h2>
              <ul aria-label="Case timeline">
                {record.detail.timeline.map((event) => (
                  <li key={event.id}>{event.summary}</li>
                ))}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </Shell>
  );
}
