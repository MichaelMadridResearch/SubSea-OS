"use client";

import { useParams } from "next/navigation";
import { CaseRecord } from "../../../case-record";
import { CasePackPreview, CategoryTable, ConsequenceSummary, HandoffNote } from "../../../case-advisory";

export default function DecisionPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";

  return (
    <CaseRecord caseId={caseId} current="decision">
      {(view) =>
        view ? (
          <>
          <section className="panel" aria-label="Decision record">
            <h2>Suggested step</h2>
            <CategoryTable
              label="Suggested step"
              columns={["Category", "Stored detail"]}
              rows={[
                { key: "step", cells: ["Suggested step", view.suggestedSentence] },
                { key: "why", cells: ["Why it leads", view.whyItLeads] },
                { key: "approval", cells: ["Approval", view.approvalSentence] },
              ]}
            />
            <h3>Assumptions</h3>
            <CategoryTable
              label="Assumptions"
              columns={["Assumption"]}
              rows={view.assumptions.map((line, index) => ({
                key: `${index}-${line}`,
                cells: [line],
              }))}
            />
            <h3>Blocked or unresolved</h3>
            {view.blocked.length > 0 ? (
              <ul aria-label="Blocking constraints">
                {view.blockerSentences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>No stored band blocks immediate action.</p>
            )}
            <h3>Missing evidence</h3>
            <CategoryTable
              label="Missing evidence"
              columns={["Source", "Statement"]}
              rows={
                view.missing.length > 0
                  ? view.missing.map((item) => ({
                      key: `${item.source}:${item.text}`,
                      cells: [item.source, item.text],
                    }))
                  : [{ key: "missing", cells: ["Not stored.", "Not stored."] }]
              }
            />
            <h3>Gated options</h3>
            <CategoryTable
              label="Gated options"
              columns={["Option", "Reason"]}
              rows={
                view.gated.length > 0
                  ? view.gated.map((option) => ({
                      key: option.label,
                      cells: [option.label, option.reason],
                    }))
                  : [{ key: "gated", cells: ["Not stored.", "No stored option is gated."] }]
              }
            />
            <p>{view.approvalSentence}</p>
            <button type="button" className="primary" disabled>
              Record approval
            </button>
            <p className="meta">This control does not send a command and does not approve the step.</p>
          </section>
          <ConsequenceSummary view={view} />
          <CasePackPreview view={view} />
          <HandoffNote view={view} />
          </>
        ) : (
          <p>Not stored.</p>
        )
      }
    </CaseRecord>
  );
}
