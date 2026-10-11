"use client";

import Link from "next/link";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "../shell";
import { openCaseCount, storedCaseHref, useWorkspace, type Workspace } from "../workspace";

const VIEWS = [
  "My Cases",
  "Needs Engineering Review",
  "Awaiting Approval",
  "Stale Evidence",
  "Closed This Quarter",
];

const FILTERS = [
  "Search cases",
  "Site",
  "Severity",
  "Status",
  "Asset",
  "Owner",
  "Failure mode",
];

export default function CasesPage() {
  const { workspace, loading, error } = useWorkspace("required");
  const openCases = openCaseCount(workspace);

  return (
    <Shell
      farm={workspace?.wind_farm_name ?? null}
      openCases={openCases}
      initials={workspace ? "OP" : "—"}
      current="cases"
    >
      {loading && !workspace ? <LoadingStatus /> : null}
      {!loading && error && !workspace ? <CriticalMessage sentence={error} /> : null}
      {workspace ? (
        <>
          <header className="page-heading">
            <div>
              <h1>Cases</h1>
              <p className="meta">
                {openCases} open cases · {workspace.wind_farm_name}
              </p>
            </div>
            <div className="actions">
              <button type="button" className="secondary" disabled>
                Columns
              </button>
              <button type="button" className="secondary" disabled>
                Export
              </button>
            </div>
          </header>
          <div className="view-row">
            {VIEWS.map((name) => (
              <button
                key={name}
                type="button"
                className={name === "My Cases" ? "primary" : "secondary"}
                disabled
                aria-current={name === "My Cases" ? "true" : undefined}
              >
                {name}
              </button>
            ))}
          </div>
          <section className="panel">
            <div className="filter-row">
              {FILTERS.map((name) => (
                <button key={name} type="button" className="secondary" disabled>
                  {name}
                </button>
              ))}
              <button type="button" className="secondary" disabled>
                Save view
              </button>
            </div>
          </section>
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Severity</th>
                <th>Asset</th>
                <th>Location</th>
                <th>Workflow stage</th>
                <th>Evidence</th>
                <th>72 h exposure</th>
                <th>Owner</th>
                <th>Age</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {workspace.display && workspace.display.queue.length > 0 ? (
                workspace.display.queue.map((row) => {
                  const href = storedCaseHref(workspace, row.external_ref);
                  return (
                    <tr key={row.external_ref}>
                      <td>
                        {href ? <Link href={href}>{row.external_ref}</Link> : row.external_ref}
                        <p>{rowSummary(workspace, row.external_ref, row.summary)}</p>
                      </td>
                      <td>{row.severity}</td>
                      <td>{workspace.cable_name}</td>
                      <td>{caseLocation(workspace, row.external_ref)}</td>
                      <td>{caseStage(workspace, row.external_ref)}</td>
                      <td>{row.evidence_completeness}</td>
                      <td>Not calculated</td>
                      <td>{row.owner}</td>
                      <td>{row.age}</td>
                      <td>{row.next_action}</td>
                    </tr>
                  );
                })
              ) : workspace.case && workspace.alert ? (
                <tr>
                  <td>
                    <Link href={`/cases/${workspace.case.id}`}>{workspace.alert.external_ref}</Link>
                    <p>{workspace.alert.summary}</p>
                  </td>
                  <td>Not calculated</td>
                  <td>{workspace.cable_name}</td>
                  <td>{vertexText(workspace)}</td>
                  <td>{workspace.case.state}</td>
                  <td>Not calculated</td>
                  <td>Not calculated</td>
                  <td>Not calculated</td>
                  <td>Not calculated</td>
                  <td>Not calculated</td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={10}>No cases.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="pager">
            <button type="button" className="secondary" disabled>
              Previous
            </button>
            <button type="button" className="secondary" disabled>
              Next
            </button>
          </div>
          <div className="split">
            <section className="panel">
              <h2>Selected case</h2>
              {workspace.case && workspace.alert ? (
                <>
                  <p>
                    <strong>{workspace.alert.external_ref}</strong>
                  </p>
                  <p>{workspace.alert.summary}</p>
                  <p className="meta">
                    {workspace.cable_name} · State {workspace.case.state}
                  </p>
                  <Link className="primary" href={`/cases/${workspace.case.id}`}>
                    Open case workspace
                  </Link>
                </>
              ) : (
                <p>No cases.</p>
              )}
            </section>
            <section className="panel">
              <h2>Queue context</h2>
              <p>
                {openCases} open
              </p>
              <p>Not calculated</p>
            </section>
          </div>
        </>
      ) : null}
    </Shell>
  );
}

function vertexText(workspace: Workspace): string {
  const index = workspace.alert?.route_vertex;
  if (index === undefined) return "Not calculated";
  const pair = workspace.route.coordinates[index];
  if (!pair) return "Not calculated";
  return `${pair[0]}, ${pair[1]}`;
}

function caseLocation(workspace: Workspace, externalRef: string): string {
  if (externalRef === "FICTIONAL-ALERT-001") return vertexText(workspace);
  return "Not a route vertex.";
}

function caseStage(workspace: Workspace, externalRef: string): string {
  if (externalRef === "FICTIONAL-ALERT-001") {
    return workspace.case ? workspace.case.state : "Not stored";
  }
  return "Not a stored case.";
}

function rowSummary(workspace: Workspace, externalRef: string, summary: string): string {
  if (workspace.alert?.external_ref === externalRef) return workspace.alert.summary;
  return summary;
}
