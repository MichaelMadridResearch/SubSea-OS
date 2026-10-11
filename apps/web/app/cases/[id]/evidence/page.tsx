"use client";

import { useParams } from "next/navigation";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "../../../shell";
import { CategoryTable } from "../../../case-advisory";
import {
  CaseTabs,
  StoredQueueMeta,
  caseResponseView,
  openCaseCount,
  useCase,
  useWorkspace,
} from "../../../workspace";

const FILTERS = ["Source", "Type", "Asset", "Verification", "Time"];

export default function EvidencePage() {
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
        <div className="screen">
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
            <CaseTabs caseId={caseId} current="evidence" />
          </header>
          <div className="split case-evidence">
          <div className="evidence-column">
          <div className="tool-row">
            <div className="tabs">
              <button type="button" aria-current="page">
                Timeline
              </button>
              <button type="button" disabled>
                Table
              </button>
            </div>
            <button type="button" className="secondary" disabled>
              Add evidence
            </button>
          </div>
          <div className="filter-row">
            {FILTERS.map((name) => (
              <button key={name} type="button" className="secondary" disabled>
                {name}
              </button>
            ))}
          </div>
          <ul className="timeline" aria-label="Evidence timeline">
            {(view?.evidence ?? record.detail.timeline.map((event) => ({
              id: event.id,
              kind: event.kind,
              summary: event.summary,
              source: event.kind,
              timestamp: "Not stored.",
              segment: "Not stored.",
              severity: "Not stored.",
              provenance: event.summary,
              stance: "Supports the stored case record.",
            }))).map((event) => (
              <li key={event.id} className="panel">
                <p className="meta">{event.kind}</p>
                <p>{event.summary}</p>
                <p className="meta">
                  Source {event.source}. Timestamp {event.timestamp} Segment {event.segment}.
                  Severity {event.severity}. Provenance {event.provenance} {event.stance}
                </p>
              </li>
            ))}
          </ul>
          </div>
          <aside className="panel provenance-drawer" aria-label="Evidence provenance">
            <h2>Evidence provenance</h2>
            {view?.evidence[0] ? (
              <CategoryTable
                label="Selected evidence"
                columns={["Category", "Stored detail"]}
                rows={[
                  { key: "source", cells: ["Source", view.evidence[0].source] },
                  { key: "timestamp", cells: ["Timestamp", view.evidence[0].timestamp] },
                  { key: "segment", cells: ["Affected segment", view.evidence[0].segment] },
                  { key: "severity", cells: ["Severity", view.evidence[0].severity] },
                  { key: "provenance", cells: ["Provenance", view.evidence[0].provenance] },
                ]}
              />
            ) : (
              <p>Not stored.</p>
            )}
            <h3>Supports the assessment</h3>
            <CategoryTable
              label="Supports the assessment"
              columns={["Source", "Statement"]}
              rows={(view?.supports.length
                ? view.supports
                : [{ source: "Not stored", text: "Not stored." }]
              ).map((entry) => ({
                key: `${entry.source}:${entry.text}`,
                cells: [entry.source, entry.text],
              }))}
            />
            <h3>Conflicts with the assessment</h3>
            <CategoryTable
              label="Conflicts with the assessment"
              columns={["Source", "Statement"]}
              rows={(view?.conflicts.length
                ? view.conflicts
                : [{ source: "Not stored", text: "Not stored." }]
              ).map((entry) => ({
                key: `${entry.source}:${entry.text}`,
                cells: [entry.source, entry.text],
              }))}
            />
            <h3>Missing evidence</h3>
            <CategoryTable
              label="Missing evidence"
              columns={["Source", "Statement"]}
              rows={(view?.missing.length
                ? view.missing
                : [{ source: "Not stored", text: "Not stored." }]
              ).map((entry) => ({
                key: `${entry.source}:${entry.text}`,
                cells: [entry.source, entry.text],
              }))}
            />
          </aside>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
