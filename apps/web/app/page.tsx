"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createApi } from "@subsea/contracts";
import { CriticalMessage, LoadingStatus } from "@subsea/ui";
import { Shell } from "./shell";
import {
  TOKEN_KEY,
  failureOf,
  useWorkspace,
  FictionalMap,
  ResponseReviewPanel,
  RouteVertices,
  openCaseCount,
  storedCaseHref,
  type Workspace,
} from "./workspace";

export default function HomePage() {
  const { token, setToken, workspace, loading, error, setError, load } = useWorkspace("optional");
  const [email, setEmail] = useState("operator@demo.invalid");
  const [password, setPassword] = useState("demo-only-not-a-secret");
  const [busy, setBusy] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const api = createApi("/backend");
    const result = await api.POST("/auth/login", { body: { email, password } });
    const failure = failureOf(result);
    if (failure || !result.data) {
      if (failure?.sentence) setError(failure.sentence);
      setBusy(false);
      return;
    }
    sessionStorage.setItem(TOKEN_KEY, result.data.token);
    setToken(result.data.token);
    await load(result.data.token);
    setBusy(false);
  }

  async function importAlert() {
    if (!token) return;
    setError("");
    setBusy(true);
    const api = createApi("/backend", token);
    const result = await api.POST("/alerts/import");
    const failure = failureOf(result);
    if (failure || !result.data) {
      if (failure?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      if (failure?.sentence) setError(failure.sentence);
      setBusy(false);
      return;
    }
    await load(token);
    setBusy(false);
  }

  async function openCase() {
    if (!token) return;
    setError("");
    setBusy(true);
    const api = createApi("/backend", token);
    const result = await api.POST("/cases");
    const failure = failureOf(result);
    if (failure || !result.data) {
      if (failure?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      if (failure?.sentence) setError(failure.sentence);
      setBusy(false);
      return;
    }
    await load(token);
    setBusy(false);
  }

  if (!token) {
    return (
      <Shell farm={null} openCases={0} initials="—" current="overview">
        <form className="panel sign-in" onSubmit={signIn}>
          <h1>Sign in</h1>
          <p>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          </p>
          <p>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </p>
          <button className="primary" type="submit" disabled={busy}>
            Sign in
          </button>
          {busy ? <LoadingStatus /> : null}
          {error ? <CriticalMessage sentence={error} /> : null}
        </form>
      </Shell>
    );
  }

  if (!workspace) {
    return (
      <Shell farm={null} openCases={0} initials="OP" current="overview">
        {loading || busy ? <LoadingStatus /> : null}
        {error ? <CriticalMessage sentence={error} /> : null}
      </Shell>
    );
  }

  const openCases = openCaseCount(workspace);
  const criticalCases = workspace.display
    ? workspace.display.queue.filter((row) => row.severity === "Critical").length
    : 0;
  const series = workspace.display?.exposure_series;
  const selectedCase = workspace.response?.active.find((row) => row.ref === selectedRef) ?? null;
  const latest = series && series.points.length > 0 ? series.points[series.points.length - 1] : undefined;

  return (
    <Shell farm={workspace.wind_farm_name} openCases={openCases} initials="OP" current="overview">
      <div className="screen">
      <header className="page-heading">
        <div>
          <h1>Operations Overview</h1>
          <h2 className="meta">{workspace.wind_farm_name}</h2>
        </div>
        <button type="button" className="secondary" disabled>
          View shift report
        </button>
      </header>
      <div className="metrics">
        <article className="panel metric">
          <p className="meta">Open cases</p>
          <strong>{openCases}</strong>
          <button type="button" className="text-action" disabled>
            View active queue
          </button>
        </article>
        <article className="panel metric">
          <p className="meta">Critical cases</p>
          <strong>{criticalCases}</strong>
          <button type="button" className="text-action" disabled>
            Review critical cases
          </button>
        </article>
        <article className="panel metric">
          <p className="meta">Awaiting approval</p>
          <strong>0</strong>
          <button type="button" className="text-action" disabled>
            Open approval queue
          </button>
        </article>
        <article className="panel metric">
          <p className="meta">Modeled exposure</p>
          <strong>
            {latest ? latest.value : "Not calculated"}
            {latest && series ? <span className="meta"> {series.unit}</span> : null}
          </strong>
          <button type="button" className="text-action" disabled>
            Review exposure assumptions
          </button>
        </article>
      </div>
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Offshore asset map</h2>
          </div>
          <FictionalMap
            coordinates={workspace.route.coordinates}
            display={workspace.display}
            focusMarkerId={selectedCase?.marker_id || null}
            focusPoint={selectedCase && !selectedCase.marker_id ? selectedCase.focus : null}
            highlightMarkerId={hoveredMarkerId}
            onHoverMarker={setHoveredMarkerId}
            onActivateMarker={(id) => {
              const match = workspace.response?.active.find((row) => row.marker_id === id);
              if (match) setSelectedRef(match.ref);
            }}
            compact
          />
          {selectedCase ? <p>{selectedCase.location_text}</p> : null}
          <p className="meta">
            {workspace.cable_name} · {workspace.route.name}
          </p>
          {workspace.display ? (
            <p className="meta">
              {workspace.display.route_metadata.label}. {workspace.display.route_metadata.name}
            </p>
          ) : null}
          <RouteVertices coordinates={workspace.route.coordinates} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Active case queue</h2>
          </div>
          <p className="meta">
            Hover a map point to highlight its case.
          </p>
          <QueueList
            workspace={workspace}
            selectedRef={selectedRef}
            hoveredMarkerId={hoveredMarkerId}
            onHover={setHoveredMarkerId}
            onSelect={setSelectedRef}
          />
          <p className="actions">
            <button className="primary" type="button" onClick={() => void importAlert()} disabled={busy}>
              Import alert
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => void openCase()}
              disabled={busy || !workspace.alert}
            >
              Open response case
            </button>
          </p>
          {busy || loading ? <LoadingStatus /> : null}
          {error ? <CriticalMessage sentence={error} /> : null}
        </section>
      </div>
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Modeled exposure over time</h2>
          </div>
          {series && series.points.length > 0 ? (
            <>
              <ExposureChart points={series.points} label={series.label} />
              <p className="meta">
                {series.label}. {series.unit}
              </p>
              <ul className="point-list" aria-label={series.label}>
                {series.points.map((point) => (
                  <li key={point.label}>
                    {point.label}: {point.value}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Not calculated</p>
          )}
          {workspace.display ? <p>{workspace.display.assumption}</p> : null}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
          </div>
          {workspace.display && workspace.display.activity.length > 0 ? (
            <ul aria-label="Recent activity">
              {workspace.display.activity.map((item) => (
                <li key={item.label}>{item.label}</li>
              ))}
            </ul>
          ) : (
            <p>Not calculated</p>
          )}
        </section>
      </div>
      <ResponseReviewPanel
        review={workspace.response}
        selectedRef={selectedRef}
        onSelect={setSelectedRef}
      />
      </div>
    </Shell>
  );
}

function QueueList({
  workspace,
  selectedRef,
  hoveredMarkerId,
  onHover,
  onSelect,
}: {
  workspace: Workspace;
  selectedRef: string | null;
  hoveredMarkerId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (ref: string) => void;
}) {
  const rows = workspace.display?.queue;
  if (!rows) {
    if (!workspace.alert) return <p className="meta">No alert imported.</p>;
    return <StoredAlertCard workspace={workspace} />;
  }
  return (
    <>
      {rows.map((row) => {
        const href = storedCaseHref(workspace, row.external_ref);
        const stored = workspace.alert?.external_ref === row.external_ref;
        const markerId =
          workspace.response?.active.find((item) => item.ref === row.external_ref)?.marker_id || "";
        const linked =
          markerId !== "" && (markerId === hoveredMarkerId || selectedRef === row.external_ref);
        const icon = row.severity === "Critical" ? "/map/anomaly-selected.svg" : "/map/anomaly-high.svg";
        return (
          <article
            key={row.external_ref}
            className={linked ? "queue-card queue-card-linked" : "queue-card"}
            onMouseEnter={() => {
              if (markerId) onHover(markerId);
            }}
            onMouseLeave={() => onHover(null)}
          >
            <p className="queue-title">
              {row.severity === "Medium" ? (
                <span className="queue-mark" aria-hidden="true">
                  ◇
                </span>
              ) : (
                <img className="queue-icon" src={icon} alt="" />
              )}
              {href ? <Link href={href}>{row.external_ref}</Link> : <strong>{row.external_ref}</strong>}
              <span className="meta"> Severity {row.severity}</span>
            </p>
            <p>{stored && workspace.alert ? workspace.alert.summary : row.summary}</p>
            {stored ? (
              <p className="meta">
                {workspace.cable_name}
                {workspace.case ? ` · State ${workspace.case.state}` : ""}
              </p>
            ) : null}
            <p className="meta">
              {row.owner} · {row.age}
            </p>
            <p className="meta">{row.next_action}</p>
            <p className="meta">{row.evidence_completeness}</p>
            <button
              type="button"
              className="secondary"
              aria-label={`Review response for ${row.external_ref}`}
              aria-pressed={selectedRef === row.external_ref}
              onClick={() => onSelect(row.external_ref)}
            >
              Review response
            </button>
          </article>
        );
      })}
      {workspace.alert ? null : <p className="meta">No alert imported.</p>}
    </>
  );
}

function StoredAlertCard({ workspace }: { workspace: Workspace }) {
  if (!workspace.alert) return null;
  const href = storedCaseHref(workspace, workspace.alert.external_ref);
  return (
    <article className="queue-card">
      {href ? <Link href={href}>{workspace.alert.external_ref}</Link> : <strong>{workspace.alert.external_ref}</strong>}
      <p>{workspace.alert.summary}</p>
      <p className="meta">{workspace.cable_name}</p>
      {workspace.case ? <p className="meta">State {workspace.case.state}</p> : null}
    </article>
  );
}

function ExposureChart({
  points,
  label,
}: {
  points: { label: string; value: number }[];
  label: string;
}) {
  const width = 320;
  const height = 140;
  const padX = 36;
  const padY = 28;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const placed = points.map((point, index) => {
    const x = padX + index * step;
    const y = padY + (1 - (point.value - low) / span) * (height - padY * 2);
    return { ...point, x, y };
  });
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline points={placed.map((point) => `${point.x},${point.y}`).join(" ")} />
      {placed.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="3" />
          <text x={point.x} y={point.y - 8} textAnchor="middle">
            {point.label} {point.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
