"use client";

import type { ReactNode } from "react";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "./shell";
import {
  CaseTabs,
  StoredQueueMeta,
  caseResponseView,
  openCaseCount,
  useCase,
  useWorkspace,
  type Workspace,
} from "./workspace";
import type { ResponseCaseView } from "./response-case";

export function CaseRecord({
  caseId,
  current,
  children,
}: {
  caseId: string;
  current: "decision" | "audit";
  children: (view: ResponseCaseView | null, workspace: Workspace) => ReactNode;
}) {
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
            <CaseTabs caseId={caseId} current={current} />
          </header>
          {children(view, session.workspace)}
        </>
      ) : null}
    </Shell>
  );
}
