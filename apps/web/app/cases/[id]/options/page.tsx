"use client";

import { useParams } from "next/navigation";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "../../../shell";
import { OptionPrerequisites } from "../../../case-advisory";
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

const CRITERIA = ["Summary", "Cost", "Weather", "Effort", "Consequence"] as const;

export default function OptionsPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";
  const session = useWorkspace("required");
  const record = useCase(session.token, caseId);
  const openCases = openCaseCount(session.workspace);
  const pending = session.loading || (Boolean(session.token) && record.loading);
  const sentence = record.error || (!session.workspace ? session.error : "");
  const options = fictionalCaseBlock(session.workspace?.display?.options);
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
            <CaseTabs caseId={caseId} current="options" />
          </header>
          <section className="panel">
            <div className="panel-heading">
              <h2>Response comparison</h2>
              <p className="meta">Suggested step from the completed window. It does not start work.</p>
            </div>
            <p className="advisory-strip">
              A person approves the next step. This software does not control equipment.
            </p>
            {view ? (
              <div className="matrix-scroll">
                <table className="data-table option-matrix">
                  <caption>{view.suggestedSentence}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Criteria</th>
                      {view.optionColumns.map((option) => (
                        <th
                          key={option.id}
                          scope="col"
                          className={option.suggested ? "option-suggested" : undefined}
                        >
                          {option.label}
                          <span className="meta"> {option.standing}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.optionRows.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">{row.name}</th>
                        {row.cells.map((cell, index) => (
                          <td
                            key={`${row.name}-${view.optionColumns[index]?.id ?? index}`}
                            className={view.optionColumns[index]?.suggested ? "option-suggested" : undefined}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Not stored.</p>
            )}
            {view ? <OptionPrerequisites view={view} /> : null}
            {storedAlert ? <p>{STORED_ALERT_REF}</p> : null}
            {options ? <p>{options.assumption}</p> : null}
            {options && options.items.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Criteria</th>
                    {options.items.map((item) => (
                      <th key={item.id} scope="col">
                        {item.title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CRITERIA.map((name) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      {options.items.map((item) => (
                        <td key={item.id}>{name === "Summary" ? item.summary : "Not calculated."}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Not calculated.</p>
            )}
          </section>
        </>
      ) : null}
    </Shell>
  );
}
