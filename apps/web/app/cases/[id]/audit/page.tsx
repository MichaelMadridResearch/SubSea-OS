"use client";

import { useParams } from "next/navigation";
import { CaseRecord } from "../../../case-record";
import { CasePackPreview, CategoryTable, HandoffNote } from "../../../case-advisory";

export default function AuditPage() {
  const params = useParams<{ id: string }>();
  const caseId = typeof params.id === "string" ? params.id : "";

  return (
    <CaseRecord caseId={caseId} current="audit">
      {(view) =>
        view ? (
          <>
          <section className="panel" aria-label="Audit record">
            <h2>Audit record</h2>
            <p className="meta">Read-only. This record does not authorize equipment control.</p>
            <CategoryTable
              label="Audit categories"
              columns={["Category", "Stored detail"]}
              rows={[
                { key: "rule", cells: ["Rule version", view.audit.ruleVersion] },
                { key: "provenance", cells: ["Fixture provenance", view.audit.provenance] },
                { key: "corroboration", cells: ["Corroboration", view.audit.corroboration] },
                { key: "overrides", cells: ["Overrides", view.audit.overrides] },
                { key: "reviewers", cells: ["Reviewers", view.audit.reviewers] },
                { key: "missing", cells: ["Missing evidence summary", view.audit.missingSummary] },
                { key: "step", cells: ["Suggested step", view.suggestedSentence] },
                { key: "approval", cells: ["Approval", view.approvalSentence] },
              ]}
            />
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
            <h3>Decision trace</h3>
            <CategoryTable
              label="Decision trace"
              columns={["Order", "Entry"]}
              rows={view.audit.trace.map((line, index) => ({
                key: `${index}-${line}`,
                cells: [String(index + 1), line],
              }))}
            />
            <h3>Case chronology</h3>
            <CategoryTable
              label="Case chronology"
              columns={["Order", "Entry"]}
              rows={
                view.audit.chronology.length > 0
                  ? view.audit.chronology.map((entry) => ({
                      key: entry.order,
                      cells: [entry.order, entry.text],
                    }))
                  : [{ key: "chronology", cells: ["Not stored.", "Not stored."] }]
              }
            />
            <h3>Case-state changes</h3>
            <CategoryTable
              label="Case-state changes"
              columns={["Change"]}
              rows={view.audit.caseChanges.map((line, index) => ({
                key: `${index}-${line}`,
                cells: [line],
              }))}
            />
          </section>
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
