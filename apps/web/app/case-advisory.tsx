import type { ResponseCaseView } from "./response-case";

export function CategoryTable({
  label,
  name,
  columns,
  rows,
}: {
  label: string;
  name?: string;
  columns: string[];
  rows: { key: string; cells: string[]; className?: string }[];
}) {
  return (
    <div className="matrix-scroll">
      <table className="data-table category-table" aria-label={name ?? label}>
        <caption>{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.className}>
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th key={`${row.key}-label`} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={`${row.key}-${index}`}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConsequenceSummary({ view }: { view: ResponseCaseView }) {
  return (
    <section className="panel" aria-label="Consequence over time">
      <h2>Consequence over time</h2>
      <p className="meta">
        Read-only stored bands. They describe what stays at risk if the case remains unresolved.
        They are not a cost and not a forecast.
      </p>
      <CategoryTable
        label="Consequence categories"
        columns={["Category", "Stored detail"]}
        rows={[
          { key: "service", cells: ["Service exposure", view.consequence.serviceExposure] },
          { key: "delay", cells: ["Delay sensitivity", view.consequence.delaySensitivity] },
          { key: "reduction", cells: ["Consequence reduction", view.consequence.reduction] },
          { key: "unknown", cells: ["Still unknown", view.consequence.unknown] },
        ]}
      />
      <CategoryTable
        label="Consequence steps"
        columns={["Step", "Stored band"]}
        rows={view.consequence.overTime.map((line, index) => ({
          key: `${index}-${line}`,
          cells: [String(index + 1), line],
        }))}
      />
    </section>
  );
}

export function OptionPrerequisites({ view }: { view: ResponseCaseView }) {
  return (
    <section aria-label="Option prerequisites">
      <h3>Prerequisites</h3>
      <p className="meta">
        Blocking constraints come from the feasibility bands. No option is approved or dispatchable.
      </p>
      <p>{view.casePrerequisites}</p>
      <CategoryTable
        label="Option prerequisites"
        columns={["Option", "Satisfied", "Missing", "Blocking", "Not calculated."]}
        rows={view.optionPrerequisites.map((item) => ({
          key: item.label,
          className: item.label === view.suggestedStep ? "hypothesis-leading" : undefined,
          cells: [item.label, item.satisfied, item.missing, item.blocking, item.notCalculated],
        }))}
      />
    </section>
  );
}

export function CasePackPreview({ view }: { view: ResponseCaseView }) {
  return (
    <section className="panel case-pack" aria-label="Case pack preview">
      <h2>Evidence package</h2>
      <p className="meta">
        Read-only preview of an evidence pack. A file export is not stored. Download stays
        unavailable because no export file is stored.
      </p>
      {view.pack.sections.map((section) => (
        <CategoryTable
          key={section.label}
          label={section.label}
          name={`Evidence package: ${section.label}`}
          columns={section.columns}
          rows={section.rows}
        />
      ))}
    </section>
  );
}

export function HandoffNote({ view }: { view: ResponseCaseView }) {
  return (
    <section className="panel handoff-contract" aria-label="Downstream handoff">
      <h2>Handoff contract</h2>
      <p>{view.handoff}</p>
      <p className="meta" id="handoff-unavailable">
        {view.handoffContract.unavailable}
      </p>
      <CategoryTable
        label="Handoff contract"
        columns={["Field", "Stored detail"]}
        rows={view.handoffContract.rows}
      />
      <button
        type="button"
        className="secondary"
        disabled
        aria-describedby="handoff-unavailable"
      >
        Send handoff
      </button>
    </section>
  );
}
