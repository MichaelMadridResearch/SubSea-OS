"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createApi } from "@subsea/contracts";
import type { components } from "@subsea/contracts";
import type { Map as MapLibreMap, Marker, MarkerOptions, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { responseCaseView, type TimelineEvent } from "./response-case";
import { suggestedStepSentence } from "./response-copy";

function StreamReplay({
  stream,
  nextStep,
}: {
  stream: components["schemas"]["ResponseCaseReview"]["stream"];
  nextStep: string;
}) {
  const [cursor, setCursor] = useState(stream.frames.length - 1);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setCursor(stream.frames.length - 1);
    setPlaying(false);
  }, [stream.session_id, stream.frames.length, nextStep]);
  useEffect(() => {
    if (!playing) return undefined;
    const handle = window.setInterval(() => {
      setCursor((current) => {
        if (current >= stream.frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [playing, stream.frames.length]);
  const frame = stream.frames[cursor] ?? stream.frames[0];
  return (
    <section className="response-stream" aria-label="Alert to intervention">
      <h3>Alert to intervention</h3>
      <p className="meta">{stream.provenance}</p>
      <ol className="response-pipeline" aria-label="Operational pipeline">
        <li>Incoming stream</li>
        <li>Anomaly detection</li>
        <li>Hazard stage {frame?.hazard_stage ?? stream.hazard_stage}</li>
        <li>{frame?.case_open ? "Response case open" : "Response case not open"}</li>
        <li>Suggested action {nextStep}</li>
      </ol>
      <p>
        Replay step {frame?.step}. Hazard stage {frame?.hazard_stage}. {frame?.reason}
      </p>
      <p>
        Evidence {frame?.evidence_state}. {frame?.evidence_detail}
      </p>
      <p>{frame?.delay_pressure}</p>
      <p>
        Case progress {frame?.progress}. {frame?.changed}
      </p>
      <section aria-label="Intervention readiness">
        <h3>Intervention readiness</h3>
        <p>
          Readiness stance {frame?.readiness_stance}. {frame?.readiness_detail} This stance does not
          change the advisory score.
        </p>
        <ul>
          <li>{stream.readiness.vessel}</li>
          <li>{stream.readiness.spare}</li>
          <li>{stream.readiness.permit}</li>
          <li>{stream.readiness.mobilization}</li>
          <li>{stream.readiness.weather}</li>
          <li>{stream.readiness.crew}</li>
        </ul>
      </section>
      <section aria-label="Why this action">
        <h3>Why this action</h3>
        <p>{frame?.why_action}</p>
        <p>{frame?.why_not_stabilize}</p>
        <p>{frame?.why_not_mobilize}</p>
        <p>{frame?.why_derate}</p>
      </section>
      <p>{stream.action_history[0]}</p>
      <p className="meta">{stream.strain}</p>
      <p className="meta">{stream.weather}</p>
      <div className="response-stream-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setCursor(0);
            setPlaying(false);
          }}
        >
          Replay stream
        </button>
        <button type="button" className="secondary" onClick={() => setPlaying(false)}>
          Pause stream
        </button>
        <button type="button" className="secondary" onClick={() => setPlaying(true)}>
          Resume stream
        </button>
      </div>
      <ol className="response-chronology" aria-label="Operational timeline">
        {stream.timeline.map((entry, index) => (
          <li key={entry.order} aria-current={index === cursor ? "step" : undefined}>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function downloadIncidentPackage(ref: string, payload: object) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `incident-package-${ref}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const TOKEN_KEY = "subsea.token";
export const STORED_ALERT_REF = "FICTIONAL-ALERT-001";

export type Workspace = components["schemas"]["Workspace"];
export type CaseDetail = components["schemas"]["CaseDetail"];
export type Display = components["schemas"]["Display"];

export function openCaseCount(workspace: Workspace | null | undefined): number {
  if (!workspace) return 0;
  if (workspace.display) return workspace.display.queue.length;
  return workspace.case ? 1 : 0;
}

export function storedCaseHref(workspace: Workspace, externalRef: string): string | null {
  if (externalRef !== STORED_ALERT_REF || !workspace.case) return null;
  return `/cases/${workspace.case.id}`;
}

export function fictionalCaseBlock<T extends { fictional: boolean; case_ref: string }>(
  block: T | undefined,
): T | null {
  if (!block || block.fictional !== true || block.case_ref !== STORED_ALERT_REF) return null;
  return block;
}

export function StoredQueueMeta({ workspace }: { workspace: Workspace }) {
  const row = workspace.display?.queue.find((item) => item.external_ref === STORED_ALERT_REF);
  if (!row) return null;
  return (
    <p className="meta">
      Severity {row.severity} · {row.owner} · {row.age}
    </p>
  );
}

const LINKED_CASE_TABS = [
  {
    name: "Hypotheses",
    current: "hypotheses",
    href: (caseId: string) => `/cases/${caseId}/hypotheses`,
  },
  { name: "Options", current: "options", href: (caseId: string) => `/cases/${caseId}/options` },
] as const;

const RECORD_CASE_TABS = [
  { name: "Decision", current: "decision", href: (caseId: string) => `/cases/${caseId}/decision` },
  { name: "Audit", current: "audit", href: (caseId: string) => `/cases/${caseId}/audit` },
] as const;

function storedCaseTabs(workspace: Workspace | null, caseId: string): boolean {
  return workspace?.alert?.external_ref === STORED_ALERT_REF && workspace.case?.id === caseId;
}

export function apiDetail(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("detail" in error)) return null;
  const detail = error.detail;
  return typeof detail === "string" && detail.length > 0 ? detail : null;
}

export function failureOf(result: {
  data?: unknown;
  error?: unknown;
  response?: Response;
}): { sentence: string | null; status: number } | null {
  if (result.data !== undefined && result.data !== null) return null;
  return {
    sentence: apiDetail(result.error),
    status: result.response?.status ?? 0,
  };
}

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function useWorkspace(mode: "optional" | "required" = "optional") {
  const [token, setToken] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(mode === "required");
  const [error, setError] = useState("");

  const load = useCallback(async (nextToken: string) => {
    setLoading(true);
    const api = createApi("/backend", nextToken);
    const result = await api.GET("/workspace");
    const failure = failureOf(result);
    if (failure || !result.data) {
      if (failure?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setWorkspace(null);
      }
      setError(failure?.sentence ?? "");
      setLoading(false);
      return null;
    }
    setError("");
    setWorkspace(result.data);
    setLoading(false);
    return result.data;
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      if (mode !== "required") return;
      const api = createApi("/backend");
      void api.GET("/workspace").then((result) => {
        setError(failureOf(result)?.sentence ?? "");
        setLoading(false);
      });
      return;
    }
    setToken(saved);
    void load(saved);
  }, [load, mode]);

  return { token, setToken, workspace, loading, error, setError, load };
}

function showLayer(layersOn: Record<string, boolean> | undefined, id: string): boolean {
  return layersOn?.[id] !== false;
}

function asPair(coordinates: number[]): [number, number] | null {
  const lon = coordinates[0];
  const lat = coordinates[1];
  if (typeof lon !== "number" || typeof lat !== "number") return null;
  return [lon, lat];
}

function framePositions(coordinates: number[][], display: Display | undefined): [number, number][] {
  const pairs = coordinates.map(asPair).filter((pair): pair is [number, number] => pair !== null);
  if (!display) return pairs;
  for (const marker of display.markers) {
    const pair = asPair(marker.coordinates);
    if (pair) pairs.push(pair);
  }
  for (const pair of display.vessel_track.coordinates) {
    const next = asPair(pair);
    if (next) pairs.push(next);
  }
  for (const pair of display.survey_overlay.coordinates) {
    const next = asPair(pair);
    if (next) pairs.push(next);
  }
  return pairs;
}

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const TILE_NOTE = "Map tiles unavailable. The route geometry is still shown.";
const SURVEY_CORRIDOR = "#bdcec5";
const LAYER_SHORT: Record<string, string> = {
  route: "Route",
  markers: "Assets",
  survey: "Surveys",
  vessel: "Vessel",
};

function blankStyle(color: string) {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background" as const,
        paint: { "background-color": color },
      },
    ],
  };
}

function fitFixture(map: MapLibreMap, coordinates: number[][], display: Display | undefined) {
  const spots = framePositions(coordinates, display);
  const first = spots[0];
  if (!first) return;
  let west = first[0];
  let east = first[0];
  let south = first[1];
  let north = first[1];
  for (const [lon, lat] of spots) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  map.fitBounds(
    [
      [west, south],
      [east, north],
    ],
    { padding: { top: 56, right: 160, bottom: 64, left: 48 }, animate: false, maxZoom: 11 },
  );
  const container = map.getContainer();
  container.dataset.mapFitted = "true";
  container.dataset.routePoints = String(coordinates.length);
}

function addRouteAndOverlays(map: MapLibreMap, coordinates: number[][], display: Display | undefined) {
  if (display && display.survey_overlay.coordinates.length >= 4) {
    map.addSource("survey", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: { label: display.survey_overlay.label },
        geometry: {
          type: "Polygon",
          coordinates: [display.survey_overlay.coordinates],
        },
      },
    });
    map.addLayer({
      id: "survey-fill",
      type: "fill",
      source: "survey",
      paint: { "fill-color": SURVEY_CORRIDOR, "fill-opacity": 0.5 },
    });
  }
  map.addSource("route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    },
  });
  map.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": cssToken("--color-primary"), "line-width": 3 },
  });
  if (!display || display.vessel_track.coordinates.length < 2) return;
  map.addSource("vessel", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: { label: display.vessel_track.label },
      geometry: { type: "LineString", coordinates: display.vessel_track.coordinates },
    },
  });
  map.addLayer({
    id: "vessel-line",
    type: "line",
    source: "vessel",
    paint: {
      "line-color": cssToken("--color-secondary"),
      "line-width": 1.5,
      "line-dasharray": [1.5, 1.5],
    },
  });
}

function syncMapOverlays(
  map: MapLibreMap,
  createMarker: (options: MarkerOptions) => Marker,
  display: Display | undefined,
  layersOn: Record<string, boolean> | undefined,
  markers: Marker[],
  selectedId: string | null,
  onSelect: (id: string) => void,
  highlightId: string | null,
  onHover: (id: string | null) => void,
): Marker[] {
  const visibility = (layerId: string, id: string) => {
    if (!map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", showLayer(layersOn, id) ? "visible" : "none");
  };
  visibility("route-line", "route");
  visibility("vessel-line", "vessel");
  visibility("survey-fill", "survey");
  for (const marker of markers) marker.remove();
  if (!display || !showLayer(layersOn, "markers")) return [];
  const next: Marker[] = [];
  for (const item of display.markers) {
    const pair = asPair(item.coordinates);
    if (!pair) continue;
    const selected = item.id === selectedId;
    const element = document.createElement("button");
    element.type = "button";
    element.className = [
      "map-marker",
      selected ? "map-marker-selected" : "",
      item.id === highlightId ? "map-marker-hover" : "",
    ]
      .filter(Boolean)
      .join(" ");
    element.dataset.kind = item.kind;
    element.setAttribute("aria-pressed", selected ? "true" : "false");
    const glyph = document.createElement("span");
    glyph.className = "map-marker-glyph";
    glyph.setAttribute("aria-hidden", "true");
    if (item.kind === "anomaly") {
      const ring = document.createElement("img");
      ring.alt = "";
      ring.src = selected ? "/map/anomaly-selected.svg" : "/map/anomaly-high.svg";
      glyph.appendChild(ring);
      if (selected) {
        const center = document.createElement("img");
        center.alt = "";
        center.className = "map-marker-center";
        center.src = "/map/anomaly-center.svg";
        glyph.appendChild(center);
      }
    }
    const label = document.createElement("span");
    label.className = item.kind === "anomaly" ? "map-marker-label map-marker-label-quiet" : "map-marker-label";
    label.textContent = item.label;
    element.append(glyph, label);
    element.addEventListener("mouseenter", () => onHover(item.id));
    element.addEventListener("mouseleave", () => onHover(null));
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(item.id);
    });
    const marker = createMarker({ element, anchor: "center" }).setLngLat(pair).addTo(map);
    element.setAttribute("aria-label", item.label);
    next.push(marker);
  }
  return next;
}

export function RouteMap({
  coordinates,
  display,
  layersOn,
  onToggleLayer,
  focusMarkerId = null,
  focusPoint = null,
  highlightMarkerId = null,
  onHoverMarker,
  onActivateMarker,
  compact = false,
}: {
  coordinates: number[][];
  display?: Display;
  layersOn?: Record<string, boolean>;
  onToggleLayer?: (id: string, checked: boolean) => void;
  focusMarkerId?: string | null;
  focusPoint?: number[] | null;
  highlightMarkerId?: string | null;
  onHoverMarker?: (id: string | null) => void;
  onActivateMarker?: (id: string) => void;
  compact?: boolean;
}) {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const createMarkerRef = useRef<((options: MarkerOptions) => Marker) | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const layersRef = useRef(layersOn);
  const focusRef = useRef(focusMarkerId);
  const focusPointRef = useRef(focusPoint);
  const highlightRef = useRef(highlightMarkerId);
  const hoverRef = useRef(onHoverMarker);
  const activateRef = useRef(onActivateMarker);
  const selectedRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tileNote, setTileNote] = useState("");
  layersRef.current = layersOn;
  focusRef.current = focusMarkerId;
  focusPointRef.current = focusPoint;
  highlightRef.current = highlightMarkerId;
  hoverRef.current = onHoverMarker;
  activateRef.current = onActivateMarker;
  selectedRef.current = selectedId;

  useEffect(() => {
    const node = mapNode.current;
    const origin = coordinates[0] ? asPair(coordinates[0]) : null;
    if (!node || !origin) return;
    let disposed = false;
    let map: MapLibreMap | undefined;
    let styleReady = false;
    let fallbackApplied = false;
    const paint = () => {
      if (!map || disposed || map.getSource("route")) return;
      map.resize();
      addRouteAndOverlays(map, coordinates, display);
      fitFixture(map, coordinates, display);
      const focusId = focusRef.current;
      const storedPoint = focusPointRef.current ? asPair(focusPointRef.current) : null;
      const focused = display?.markers.find((marker) => marker.id === focusId);
      const focusPair = focused ? asPair(focused.coordinates) : storedPoint;
      if (focusPair && (focusId || storedPoint)) {
        const span = 0.12;
        map.fitBounds(
          [
            [focusPair[0] - span, focusPair[1] - span],
            [focusPair[0] + span, focusPair[1] + span],
          ],
          { padding: 48, animate: false, maxZoom: 11 },
        );
        setSelectedId(focusId || null);
      }
      markersRef.current = syncMapOverlays(
        map,
        createMarkerRef.current!,
        display,
        layersRef.current,
        markersRef.current,
        selectedRef.current,
        (id) => {
          setSelectedId(id);
          activateRef.current?.(id);
        },
        highlightRef.current,
        (id) => hoverRef.current?.(id),
      );
    };
    const applyTileFallback = () => {
      if (!map || disposed || fallbackApplied || styleReady) return;
      fallbackApplied = true;
      setTileNote(TILE_NOTE);
      map.setStyle(blankStyle(cssToken("--color-map-canvas")));
    };
    void import("maplibre-gl").then(async ({ default: maplibregl }) => {
      if (disposed) return;
      const createMarker = (options: MarkerOptions) => new maplibregl.Marker(options);
      createMarkerRef.current = createMarker;
      let style: string | ReturnType<typeof blankStyle> = MAP_STYLE_URL;
      try {
        const response = await fetch(MAP_STYLE_URL);
        if (!response.ok) throw new Error("style");
      } catch {
        style = blankStyle(cssToken("--color-map-canvas"));
        setTileNote(TILE_NOTE);
        fallbackApplied = true;
      }
      if (disposed) return;
      map = new maplibregl.Map({
        container: node,
        center: origin,
        zoom: 7,
        dragPan: true,
        dragRotate: false,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        touchPitch: false,
        keyboard: true,
        pitchWithRotate: false,
        attributionControl: false,
        style,
      });
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 64, unit: "metric" }), "bottom-left");
      mapRef.current = map;
      map.on("style.load", () => {
        styleReady = true;
        paint();
      });
      map.on("error", (event) => {
        const message = event.error instanceof Error ? event.error.message : "";
        if (/style|Failed to fetch|NetworkError|Load failed|ajax/i.test(message)) applyTileFallback();
      });
    });
    return () => {
      disposed = true;
      popupRef.current?.remove();
      popupRef.current = null;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      createMarkerRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [coordinates, display]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("route")) return;
    const current = popupRef.current;
    popupRef.current = null;
    current?.remove();
    if (!display || !selectedId) return;
    const item = display.markers.find((marker) => marker.id === selectedId);
    const pair = item ? asPair(item.coordinates) : null;
    if (!item || !pair) return;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (selectedRef.current !== item.id || !mapRef.current) return;
      const body = document.createElement("div");
      body.className = "map-popup";
      const title = document.createElement("p");
      title.className = "map-popup-title";
      title.textContent = item.label;
      const meta = document.createElement("p");
      meta.className = "map-popup-meta";
      meta.textContent = item.status;
      body.append(title, meta);
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: true,
        offset: 16,
        anchor: "top",
        className: "map-popup-wrap",
      })
        .setLngLat(pair)
        .setDOMContent(body)
        .addTo(mapRef.current);
      popupRef.current = popup;
      popup.on("close", () => {
        if (popupRef.current !== popup) return;
        popupRef.current = null;
        setSelectedId(null);
      });
    });
  }, [coordinates, display, layersOn, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const createMarker = createMarkerRef.current;
    if (!map || !createMarker || !map.getSource("route")) return;
    markersRef.current = syncMapOverlays(
      map,
      createMarker,
      display,
      layersOn,
      markersRef.current,
      selectedId,
      (id) => {
        setSelectedId(id);
        activateRef.current?.(id);
      },
      highlightMarkerId ?? null,
      (id) => hoverRef.current?.(id),
    );
  }, [coordinates, display, layersOn, selectedId, highlightMarkerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("route")) return;
    const storedPoint = focusPoint ? asPair(focusPoint) : null;
    if (!focusMarkerId && storedPoint) {
      const span = 0.12;
      map.fitBounds(
        [
          [storedPoint[0] - span, storedPoint[1] - span],
          [storedPoint[0] + span, storedPoint[1] + span],
        ],
        { padding: 48, animate: false, maxZoom: 11 },
      );
      setSelectedId(null);
      return;
    }
    if (!focusMarkerId) {
      fitFixture(map, coordinates, display);
      return;
    }
    const item = display?.markers.find((marker) => marker.id === focusMarkerId);
    const pair = item ? asPair(item.coordinates) : null;
    if (!pair) return;
    const span = 0.12;
    map.fitBounds(
      [
        [pair[0] - span, pair[1] - span],
        [pair[0] + span, pair[1] + span],
      ],
      { padding: 48, animate: false, maxZoom: 11 },
    );
    setSelectedId(focusMarkerId);
  }, [coordinates, display, focusMarkerId, focusPoint]);

  const markersOn = showLayer(layersOn, "markers");
  const surveyOn = showLayer(layersOn, "survey");
  const vesselOn = showLayer(layersOn, "vessel");
  const keyItems: { id: string; label: string; icon?: string; swatch?: string }[] = [
    { id: "cable", label: "Cable route", swatch: "cable" },
  ];
  if (markersOn) {
    keyItems.unshift(
      { id: "critical", label: "! Critical", icon: "/map/anomaly-selected.svg" },
      { id: "high", label: "△ High", icon: "/map/anomaly-high.svg" },
    );
  }
  if (surveyOn) keyItems.push({ id: "survey", label: "Survey", swatch: "survey" });
  if (vesselOn) keyItems.push({ id: "vessel", label: "Vessel", swatch: "vessel" });

  return (
    <>
      {tileNote ? (
        <p className="meta" role="status">
          {tileNote}
        </p>
      ) : null}
      <div className={compact ? "map-stage map-compact" : "map-stage"}>
        <div ref={mapNode} className="map" role="img" aria-label="Harbor Light route map" />
        {display && display.layers.length > 0 && onToggleLayer ? (
          <div className="map-layer-chip">
            <span>Layers</span>
            {display.layers.map((layer) => {
              const checked = showLayer(layersOn, layer.id);
              return (
                <label key={layer.id}>
                  <input
                    type="checkbox"
                    aria-label={layer.label}
                    checked={checked}
                    onChange={(event) => onToggleLayer(layer.id, event.target.checked)}
                  />
                  <span aria-hidden="true">
                    {checked ? "✓ " : ""}
                    {LAYER_SHORT[layer.id] ?? layer.label}
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}
        <ul className="map-key" aria-label="Map key">
          {keyItems.map((item) => (
            <li key={item.id}>
              {item.icon ? (
                <span className="map-key-icon" style={{ backgroundImage: `url("${item.icon}")` }} />
              ) : (
                <span className={`map-key-${item.swatch}`} />
              )}
              {item.label}
            </li>
          ))}
        </ul>
        <div className="map-nav">
          <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
            −
          </button>
          <button
            type="button"
            aria-label="Recenter map"
            onClick={() => {
              const map = mapRef.current;
              if (map) fitFixture(map, coordinates, display);
            }}
          >
            Recenter
          </button>
        </div>
      </div>
    </>
  );
}

export function FictionalMap({
  coordinates,
  display,
  focusMarkerId = null,
  focusPoint = null,
  highlightMarkerId = null,
  onHoverMarker,
  onActivateMarker,
  compact = false,
}: {
  coordinates: number[][];
  display?: Display;
  focusMarkerId?: string | null;
  focusPoint?: number[] | null;
  highlightMarkerId?: string | null;
  onHoverMarker?: (id: string | null) => void;
  onActivateMarker?: (id: string) => void;
  compact?: boolean;
}) {
  const [layersOn, setLayersOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((display?.layers ?? []).map((layer) => [layer.id, true])),
  );
  const markersOn = showLayer(layersOn, "markers");
  const vesselOn = showLayer(layersOn, "vessel");
  const surveyOn = showLayer(layersOn, "survey");

  return (
    <>
      <RouteMap
        coordinates={coordinates}
        display={display}
        layersOn={layersOn}
        compact={compact}
        focusMarkerId={focusMarkerId}
        focusPoint={focusPoint}
        highlightMarkerId={highlightMarkerId}
        onHoverMarker={onHoverMarker}
        onActivateMarker={onActivateMarker}
        onToggleLayer={(id, checked) => setLayersOn((current) => ({ ...current, [id]: checked }))}
      />
      {display && markersOn ? (
        <ul className={compact ? "marker-legend" : undefined} aria-label="Marker legend">
          {display.markers.map((marker) => (
            <li key={marker.id}>
              {marker.label}. {marker.status}
            </li>
          ))}
        </ul>
      ) : null}
      {display && (vesselOn || surveyOn) ? (
        <p className="meta">
          {vesselOn ? display.vessel_track.label : ""}
          {vesselOn && surveyOn ? " · " : ""}
          {surveyOn ? display.survey_overlay.label : ""}
        </p>
      ) : null}
    </>
  );
}

export type ResponseReview = components["schemas"]["ResponseReview"];

function signalValue(
  inputs: { [key: string]: unknown } | undefined,
  key: string,
): string {
  const signals = inputs?.signals;
  if (!signals || typeof signals !== "object") return "not stored";
  const value = (signals as Record<string, unknown>)[key];
  return typeof value === "number" ? String(value) : "not stored";
}

export function ResponseReviewPanel({
  review,
  selectedRef,
  onSelect,
}: {
  review: ResponseReview | undefined;
  selectedRef: string | null;
  onSelect?: (ref: string) => void;
}) {
  const item = review?.active.find((row) => row.ref === selectedRef) ?? null;
  if (!review) return null;
  return (
    <section className="panel response-review" aria-label="Response review">
      <div className="panel-heading">
        <h2>Response review</h2>
      </div>
      <p>{review.assumption}</p>
      <p className="meta">Rule {review.rule_version}</p>
      <h3>Assets</h3>
      <ul>
        {review.assets.map((asset) => (
          <li key={asset.id}>
            {asset.role}. {asset.placement}
          </li>
        ))}
      </ul>
      <h3>Available and unused</h3>
      <ul>
        {review.unused_assets.map((asset) => (
          <li key={asset.asset}>
            {asset.asset}. {asset.reason}
          </li>
        ))}
      </ul>
      {onSelect
        ? review.active
            .filter((row) => !row.marker_id)
            .map((row) => (
              <button
                key={row.ref}
                type="button"
                className="secondary"
                aria-label={`Review response for ${row.ref}`}
                aria-pressed={selectedRef === row.ref}
                onClick={() => onSelect(row.ref)}
              >
                Review mixed response
              </button>
            ))
        : null}
      {!item ? <p>Select a queue row or the mixed response.</p> : null}
      {item ? (
        <>
          <header className="response-case-header">
            <h3>
              {item.ref} · Severity {item.severity}
            </h3>
            <p>{item.location_text}</p>
            <p className="meta">{item.opened}</p>
            <p className="meta">
              {item.anomaly_classes.length > 0
                ? `Matched rules: ${item.anomaly_classes.join(", ")}.`
                : "No demonstration rule matched."}
            </p>
            <p>{item.context}</p>
            <ol className="response-pipeline" aria-label="How this case was built">
              <li>Sensor window</li>
              <li>Risk flag</li>
              <li>Explanations</li>
              <li>Ranked responses</li>
            </ol>
            <p>
              Sensor window: thermal {signalValue(item.inputs, "thermal_index")}, load{" "}
              {signalValue(item.inputs, "load_index")}, acoustic{" "}
              {signalValue(item.inputs, "acoustic_index")}, insulation decline{" "}
              {signalValue(item.inputs, "insulation_decline_count")}. Risk flag:{" "}
              {item.stream.hazard_stage}. {item.stream.case_open ? "Case open." : "Case not open."}{" "}
              Leading explanation: {item.hypotheses[0]?.name ?? "none"} at rank{" "}
              {item.hypotheses[0]?.advisory_rank ?? "not stored"}.{" "}
              {suggestedStepSentence(
                item.next_step,
                item.options.find((option) => option.label === item.next_step)?.advisory_rank ??
                  item.options[0]?.advisory_rank ??
                  "not stored",
              )}
            </p>
          </header>
          <StreamReplay stream={item.stream} nextStep={item.next_step} />
          <div className="response-recommendation">
            <h3>Advisory next step</h3>
            <p className="response-recommendation-label">{item.next_step}</p>
            <p>{item.audit.rationale}</p>
          </div>
          {item.certainty_limited ? (
            <p className="response-limited">{item.certainty_reason}</p>
          ) : (
            <p>{item.uncertainty}</p>
          )}
          <h3>What the evidence does</h3>
          <h4>What supports the leading interpretation</h4>
          <ul>
            {item.evidence_for.map((entry) => (
              <li key={`${entry.source}:${entry.text}`}>
                {entry.source}. {entry.text}
              </li>
            ))}
          </ul>
          <h4>What conflicts with it</h4>
          <ul>
            {item.evidence_against.map((entry) => (
              <li key={`${entry.source}:${entry.text}`}>
                {entry.source}. {entry.text}
              </li>
            ))}
          </ul>
          <h4>What is missing</h4>
          <ul>
            {item.evidence_missing.map((entry) => (
              <li key={`${entry.source}:${entry.text}`}>
                {entry.source}. {entry.text}
              </li>
            ))}
          </ul>
          <h4>What would reduce uncertainty</h4>
          <p>{item.would_reduce}</p>
          <h3>Ranked responses</h3>
          <p className="meta">
            Advisory score = urgency + feasibility + consequence reduction − execution burden −
            uncertainty penalty. A higher score is the step the stored bands favor. It does not
            start work, and it is not a chance of failure.
          </p>
          <p className="meta">{review.option_formula}</p>
          <table className="response-score">
            <caption>Advisory scores</caption>
            <thead>
              <tr>
                <th scope="col">Step</th>
                <th scope="col">Urgency</th>
                <th scope="col">Feasibility</th>
                <th scope="col">Consequence reduction</th>
                <th scope="col">Execution burden</th>
                <th scope="col">Uncertainty penalty</th>
                <th scope="col">Advisory score</th>
              </tr>
            </thead>
            <tbody>
              {item.options.map((option) => (
                <tr
                  key={option.id}
                  className={option.label === item.next_step ? "response-winner" : undefined}
                >
                  <th scope="row">{option.label}</th>
                  <td>{option.components.urgency}</td>
                  <td>{option.components.feasibility}</td>
                  <td>{option.components.consequence_reduction}</td>
                  <td>{option.components.execution_burden}</td>
                  <td>{option.components.uncertainty_penalty}</td>
                  <td>{option.advisory_rank}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="response-delay">{item.delay_model.statement}</p>
          <h3>Delay pathway</h3>
          <ol className="response-pathway" aria-label="Delay pathway">
            {item.delay_pathway.map((step) => (
              <li key={step.label}>
                {step.label}. Exposure {step.exposure_band}. Proxy {step.proxy_band}. Outage band{" "}
                {step.outage_band}. Service band {step.service_band}. {step.marine} Leading option{" "}
                {step.leading_option}.
                {step.same_option_holds
                  ? " The same leading option holds."
                  : " The stored recommendation stays."}
              </li>
            ))}
          </ol>
          <h3>Bounded impact</h3>
          <section className="response-derived" aria-label="Bounded impact">
            <p className="meta">Derived beside the consequence proxy. Not a score term.</p>
            <p>{item.bounded_impact.statement}</p>
            <p>{item.bounded_impact.delay_sensitivity}</p>
          </section>
          <h3>Option comparison</h3>
          <ul>
            {item.options.map((option) => (
              <li key={option.id}>
                {option.label}. Feasibility {option.comparison.feasibility}. Prerequisite burden{" "}
                {option.comparison.prerequisite_burden}. Downtime pressure{" "}
                {option.comparison.downtime_pressure}. Financial pressure{" "}
                {option.comparison.financial_pressure}. {option.comparison.confidence}{" "}
                {option.why_not_leading}
              </li>
            ))}
          </ul>
          {item.options
            .filter((option) => option.id === "derate")
            .map((option) => (
              <p key={option.id} className="meta">
                {option.label} is available and down-ranked. Advisory score {option.advisory_rank}.{" "}
                {option.execution_note}
              </p>
            ))}
          {item.excluded_options.map((option) => (
            <p key={option.id} className="meta">
              {option.label} is not available. {option.reason}
            </p>
          ))}
          <h3>Marine feasibility</h3>
          <p>{item.marine.ranking_effect}</p>
          <ul>
            <li>Vessel readiness. Band {item.marine.scores.vessel}. {item.marine.vessel_readiness}</li>
            <li>Weather window. Band {item.marine.scores.weather}. {item.marine.weather_window}</li>
            <li>Spare readiness. Band {item.marine.scores.spare}. {item.marine.spare_readiness}</li>
            <li>
              Inspection feasibility. Band {item.marine.scores.inspection}.{" "}
              {item.marine.inspection_feasibility}
            </li>
            <li>Mobilization lead time. {item.marine.mobilization_lead_time}</li>
            <li>Prerequisite completeness. {item.marine.prerequisite_completeness}</li>
          </ul>
          <h4>Operational readiness</h4>
          <ul>
            {item.marine.readiness.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3>Consequence exposure</h3>
          <p>{item.consequence_exposure}</p>
          <dl className="response-comparison">
            <div>
              <dt>Outage exposure</dt>
              <dd>Band {item.consequence_model.outage_exposure}</dd>
            </div>
            <div>
              <dt>Service impact</dt>
              <dd>Band {item.consequence_model.service_impact}</dd>
            </div>
            <div>
              <dt>Delay sensitivity</dt>
              <dd>Band {item.consequence_model.delay_sensitivity}</dd>
            </div>
            <div>
              <dt>Lead-time effect</dt>
              <dd>Band {item.consequence_model.lead_time_effect}</dd>
            </div>
            <div>
              <dt>Exposure band</dt>
              <dd>{item.consequence_model.exposure_band}</dd>
            </div>
          </dl>
          <p className="response-proxy">{item.consequence_model.proxy_statement}</p>
          <p className="meta">{item.consequence_model.inspection_lead_time}</p>
          <p className="meta">{item.consequence_model.repair_lead_time}</p>
          <p className="meta">{item.consequence_model.permit_delay}</p>
          <h3>Case summary</h3>
          <dl className="response-comparison">
            <div>
              <dt>Urgency</dt>
              <dd>{item.urgency}</dd>
            </div>
            <div>
              <dt>Feasibility</dt>
              <dd>{item.feasibility}</dd>
            </div>
            <div>
              <dt>Prerequisites</dt>
              <dd>{item.prerequisites}</dd>
            </div>
          </dl>
          <h3>What could explain this</h3>
          <p className="meta">
            Rank = support minus conflict minus the missing-evidence penalty. A higher rank means
            more stored readings agree with that explanation. The missing penalty is the same for
            every explanation. This is not a chance of failure.
          </p>
          <p className="meta">{review.hypothesis_formula}</p>
          <ol className="response-rank" aria-label="Explanations">
            {item.hypotheses.map((hypothesis, index) => (
              <li key={hypothesis.name}>
                <p>
                  <strong>
                    {index + 1}. {hypothesis.name}
                  </strong>
                  <span className="meta"> Rank {hypothesis.advisory_rank}</span>
                </p>
                <p>{hypothesis.explanation}</p>
                <p className="meta">
                  Support {hypothesis.support_score}. Conflict penalty {hypothesis.conflict_penalty}.
                  Missing penalty {hypothesis.missing_penalty}. {hypothesis.support} {hypothesis.conflict}
                </p>
              </li>
            ))}
          </ol>
          <h3>Chronology</h3>
          <ol className="response-chronology" aria-label="Decision chronology">
            {item.chronology.map((entry) => (
              <li key={entry.order}>{entry.text}</li>
            ))}
          </ol>
          <h3>Incident package</h3>
          <section aria-label="Incident package" className="response-package">
            <p className="meta">
              On-screen record. JSON download is available. A formatted file export is still deferred.
            </p>
            <button
              type="button"
              className="secondary"
              onClick={() => downloadIncidentPackage(item.ref, item.incident_package)}
            >
              Download incident package
            </button>
            <dl className="response-comparison">
              <div>
                <dt>Anomaly</dt>
                <dd>{item.incident_package.anomaly_summary}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{item.incident_package.location}</dd>
              </div>
              <div>
                <dt>Recommendation</dt>
                <dd>{item.incident_package.recommendation}</dd>
              </div>
              <div>
                <dt>Uncertainty</dt>
                <dd>{item.incident_package.uncertainty}</dd>
              </div>
              <div>
                <dt>Consequence proxy</dt>
                <dd>{item.incident_package.consequence_proxy}</dd>
              </div>
              <div>
                <dt>Human approval</dt>
                <dd>{item.incident_package.human_approval}</dd>
              </div>
              <div>
                <dt>Bounded impact</dt>
                <dd>{item.incident_package.bounded_impact}</dd>
              </div>
              <div>
                <dt>Precedent influence</dt>
                <dd>{item.incident_package.precedent_influence}</dd>
              </div>
              <div>
                <dt>Stream session</dt>
                <dd>{item.incident_package.stream_session}</dd>
              </div>
              <div>
                <dt>Hazard history</dt>
                <dd>
                  {
                    item.incident_package.hazard_history[
                      item.incident_package.hazard_history.length - 1
                    ]
                  }
                </dd>
              </div>
            </dl>
            <ul>
              {item.incident_package.delay_pathway.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="meta">{item.incident_package.live_rescore}</p>
          </section>
          <h3>Decision audit</h3>
          <section aria-label="Decision audit" className="response-audit">
            <dl className="response-comparison">
              <div>
                <dt>Recommended next step</dt>
                <dd>{item.audit.recommended_next_step}</dd>
              </div>
              <div>
                <dt>Why it won</dt>
                <dd>{item.audit.why_it_won}</dd>
              </div>
              <div>
                <dt>Anomaly inputs</dt>
                <dd>{item.audit.anomaly_inputs}</dd>
              </div>
              <div>
                <dt>Uncertainty</dt>
                <dd>{item.audit.uncertainty_statement}</dd>
              </div>
              <div>
                <dt>Rule</dt>
                <dd>{item.audit.rule_version}</dd>
              </div>
              <div>
                <dt>Review context</dt>
                <dd>{item.audit.review_context}</dd>
              </div>
              <div>
                <dt>Score basis</dt>
                <dd>{item.audit.score_basis}</dd>
              </div>
              <div>
                <dt>Delay effect</dt>
                <dd>{item.audit.delay_effect}</dd>
              </div>
              <div>
                <dt>Bounded rationale</dt>
                <dd>{item.audit.bounded_rationale}</dd>
              </div>
            </dl>
            <h4>Options considered</h4>
            <ul>
              {item.audit.options_considered.map((option) => (
                <li key={option.label}>
                  {option.label}. {option.status}. Score {option.score_text}.
                </li>
              ))}
            </ul>
            <h4>Precedent influence</h4>
            {item.audit.precedent_influence.length === 0 ? <p>No precedent was used.</p> : null}
            <ul>
              {item.audit.precedent_influence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h4>Why other options stay off the winning step</h4>
            <ul>
              {item.audit.elimination.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>{item.audit.human_approval}</p>
            <p className="meta">{item.audit.live_rescore}</p>
            <details>
              <summary>Assumptions used</summary>
              <ul>
                {item.audit.assumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </details>
          </section>
          <section className="response-recorded" aria-label="Recorded precedent">
            <h3>Precedent comparison</h3>
            <p>{item.precedent_influence.framing}</p>
            <p className="meta">{item.precedent_influence.does_not_replace_score}</p>
            {item.precedent.length === 0 ? <p>No similar case is stored.</p> : null}
            <ul>
              {item.precedent.map((prior) => (
                <li key={prior.ref}>
                  {prior.stance}. {prior.ref}. {prior.outcome} {prior.lesson} {prior.changes}
                  <p>What matched</p>
                  <ul>
                    {prior.matched.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <p>What differed</p>
                  <ul>
                    {prior.differed.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <h3>Closed-case playback</h3>
            <p className="meta">Recorded outcomes. Live re-scoring is still deferred.</p>
            <ul aria-label="Closed cases">
              {review.historical.map((prior) => (
                <li key={prior.ref}>
                  {prior.ref}. Recorded anomaly: {prior.anomaly}. Leading interpretation:{" "}
                  {prior.pattern}. Recorded response: {prior.chosen}. {prior.outcome} Evidence that
                  mattered: {prior.evidence_that_mattered} Missing at the time:{" "}
                  {prior.missing_at_the_time} What changed the outcome: {prior.what_changed}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}

export function RouteVertices({ coordinates }: { coordinates: number[][] }) {
  return (
    <ul aria-label="Route vertices">
      {coordinates.map((pair) => (
        <li key={`${pair[0]},${pair[1]}`}>
          {pair[0]}, {pair[1]}
        </li>
      ))}
    </ul>
  );
}

export function useCase(token: string | null, caseId: string) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !caseId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const api = createApi("/backend", token);
    void api.GET("/cases/{case_id}", { params: { path: { case_id: caseId } } }).then((result) => {
      if (cancelled) return;
      const failure = failureOf(result);
      if (failure || !result.data) {
        setDetail(null);
        setError(failure?.sentence ?? "");
      } else {
        setError("");
        setDetail(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, caseId]);

  return { detail, loading, error };
}

export function storedActiveCase(workspace: Workspace | null | undefined) {
  return workspace?.response?.active.find((row) => row.ref === STORED_ALERT_REF) ?? null;
}

export function caseResponseView(
  workspace: Workspace | null | undefined,
  caseId: string,
  timeline: TimelineEvent[],
) {
  return responseCaseView({
    requestedCaseId: caseId,
    storedCaseId: workspace?.case?.id ?? null,
    alertRef: workspace?.alert?.external_ref ?? null,
    expectedRef: STORED_ALERT_REF,
    routeName: workspace?.route.name ?? null,
    review: storedActiveCase(workspace),
    timeline,
  });
}

export function CaseTabs({
  caseId,
  current,
}: {
  caseId: string;
  current: "overview" | "evidence" | "hypotheses" | "options" | "feasibility" | "decision" | "audit";
}) {
  const { workspace } = useWorkspace();
  const linked = storedCaseTabs(workspace, caseId);
  const feasibility = fictionalCaseBlock(workspace?.display?.feasibility);
  const feasibilityCurrent = current === "feasibility" ? "page" : undefined;

  return (
    <div className="tabs">
      <Link href={`/cases/${caseId}`} aria-current={current === "overview" ? "page" : undefined}>
        Overview
      </Link>
      <Link
        href={`/cases/${caseId}/evidence`}
        aria-current={current === "evidence" ? "page" : undefined}
      >
        Evidence
      </Link>
      {LINKED_CASE_TABS.map((tab) =>
        linked ? (
          <Link
            key={tab.name}
            href={tab.href(caseId)}
            aria-current={current === tab.current ? "page" : undefined}
          >
            {tab.name}
          </Link>
        ) : (
          <button key={tab.name} type="button" disabled>
            {tab.name}
          </button>
        ),
      )}
      {linked && feasibility ? (
        <Link href={`/cases/${caseId}/feasibility`} aria-current={feasibilityCurrent}>
          Feasibility
        </Link>
      ) : (
        <button type="button" disabled aria-current={feasibilityCurrent}>
          Feasibility
        </button>
      )}
      {RECORD_CASE_TABS.map((tab) =>
        linked ? (
          <Link
            key={tab.name}
            href={tab.href(caseId)}
            aria-current={current === tab.current ? "page" : undefined}
          >
            {tab.name}
          </Link>
        ) : (
          <button key={tab.name} type="button" disabled>
            {tab.name}
          </button>
        ),
      )}
    </div>
  );
}
