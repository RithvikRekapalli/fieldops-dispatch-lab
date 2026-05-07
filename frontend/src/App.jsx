import {
  Activity,
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Crosshair,
  Download,
  FileJson,
  GitCompareArrows,
  LocateFixed,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Upload,
  Users,
  WifiOff,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";

const algorithmLabels = {
  greedy: "Greedy",
  hungarian: "Hungarian"
};

const algorithmTone = {
  greedy: "#2563eb",
  hungarian: "#0f766e"
};

const metricDefinitions = [
  { key: "fill_rate", label: "Fill", type: "percent", icon: CheckCircle2 },
  { key: "priority_served_rate", label: "Priority", type: "percent", icon: ShieldCheck },
  { key: "total_travel_km", label: "Travel", type: "number", icon: Route },
  { key: "objective_score", label: "Objective", type: "number", icon: CircleGauge }
];

const scenarioActions = [
  {
    id: "emergency",
    label: "Add P5 Emergency",
    icon: TriangleAlert,
    tone: "danger"
  },
  {
    id: "floater",
    label: "Add Flex Tech",
    icon: Plus,
    tone: "success"
  },
  {
    id: "radius",
    label: "Tighten Radius",
    icon: Crosshair,
    tone: "neutral"
  },
  {
    id: "reset",
    label: "Reset",
    icon: RotateCcw,
    tone: "neutral"
  }
];

const skillPalette = {
  controls: "#0f766e",
  electrical: "#7c3aed",
  mechanical: "#2563eb",
  instrumentation: "#b45309",
  network: "#be123c",
  hvac: "#0369a1",
  safety: "#166534"
};

function formatMetric(value, type) {
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a";
  if (type === "percent") return `${Math.round(value * 100)}%`;
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatTime(value) {
  if (!value) return "n/a";
  return value.slice(11, 16);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function isScenarioPayload(payload) {
  return (
    payload &&
    Array.isArray(payload.resources) &&
    Array.isArray(payload.requests) &&
    payload.config &&
    typeof payload.config === "object"
  );
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with ${response.status}`);
  }
  return response.json();
}

function App() {
  const originalScenario = useRef(null);
  const importInputRef = useRef(null);
  const [scenario, setScenario] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("hungarian");
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [status, setStatus] = useState("Loading scenario");
  const [isRunning, setIsRunning] = useState(false);
  const [mapTilesOk, setMapTilesOk] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const nextScenario = await fetchJson("/api/scenario");
        originalScenario.current = clone(nextScenario);
        setScenario(nextScenario);
        setSelectedRequestId(nextScenario.requests[0]?.id ?? null);
        await runComparison(nextScenario);
      } catch (error) {
        setStatus(error.message);
      }
    }
    load();
  }, []);

  async function runComparison(nextScenario = scenario) {
    if (!nextScenario) return;
    setIsRunning(true);
    setStatus("Optimizing");
    try {
      const payload = await fetchJson("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextScenario)
      });
      setResults(payload.results);
      setStatus("Ready");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsRunning(false);
    }
  }

  function updateConfig(key, value) {
    setScenario((current) => ({
      ...current,
      config: { ...current.config, [key]: value }
    }));
    setStatus("Weights changed");
  }

  function applyScenario(nextScenario) {
    setScenario(nextScenario);
    if (!nextScenario.requests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(nextScenario.requests[0]?.id ?? null);
    }
    runComparison(nextScenario);
  }

  function handleScenarioAction(actionId) {
    if (!scenario) return;
    const next = clone(scenario);

    if (actionId === "reset") {
      applyScenario(clone(originalScenario.current));
      setSelectedRequestId(originalScenario.current.requests[0]?.id ?? null);
      return;
    }

    if (actionId === "radius") {
      next.config.max_travel_km = next.config.max_travel_km <= 35 ? 68 : 35;
      applyScenario(next);
      return;
    }

    if (actionId === "floater") {
      const sequence = next.resources.filter((resource) => resource.id.startsWith("tech-flex")).length + 1;
      next.resources.push({
        id: `tech-flex-${sequence}`,
        name: `Jordan Flex ${sequence}`,
        location: { lat: 42.0334, lon: -88.0834, label: "Schaumburg" },
        skills: ["controls", "electrical", "mechanical", "instrumentation", "network"],
        available_from: "2026-02-02T08:00:00",
        available_until: "2026-02-02T18:00:00",
        busy_windows: [],
        hourly_cost: 126
      });
      applyScenario(next);
      return;
    }

    if (actionId === "emergency") {
      const sequence = next.requests.filter((request) => request.id.startsWith("req-emergency")).length + 1;
      const id = `req-emergency-${sequence}`;
      next.requests.unshift({
        id,
        customer: `Emergency compressor trip ${sequence}`,
        location: { lat: 42.0416, lon: -87.8874, label: "Des Plaines" },
        required_skill: "controls",
        priority: 5,
        window_start: "2026-02-02T09:30:00",
        window_end: "2026-02-02T11:00:00",
        duration_minutes: 80
      });
      setSelectedRequestId(id);
      applyScenario(next);
    }
  }

  function exportScenario() {
    downloadJson(scenario, "fieldops-scenario.json");
    setStatus("Scenario exported");
  }

  function exportResults() {
    downloadJson(
      {
        exported_at: new Date().toISOString(),
        scenario,
        results
      },
      "fieldops-allocation-results.json"
    );
    setStatus("Results exported");
  }

  function openScenarioImport() {
    importInputRef.current?.click();
  }

  function importScenario(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        if (!isScenarioPayload(payload)) {
          throw new Error("Scenario must include resources, requests, and config.");
        }
        originalScenario.current = clone(payload);
        setSelectedRequestId(payload.requests[0]?.id ?? null);
        applyScenario(payload);
        setStatus(`Imported ${file.name}`);
      } catch (error) {
        setStatus(error.message);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  const selectedResult = results?.[selectedAlgorithm];
  const requestById = useMemo(
    () => new Map((scenario?.requests || []).map((request) => [request.id, request])),
    [scenario]
  );
  const resourceById = useMemo(
    () => new Map((scenario?.resources || []).map((resource) => [resource.id, resource])),
    [scenario]
  );
  const selectedRequest = requestById.get(selectedRequestId) || scenario?.requests?.[0];
  const winner = useMemo(() => pickWinner(results), [results]);
  const comparison = useMemo(() => buildComparison(results), [results]);

  if (!scenario) {
    return (
      <main className="shell shell--empty">
        <div className="loading-panel">
          <Wrench size={28} />
          <p>{status}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <input
        ref={importInputRef}
        accept="application/json"
        className="visually-hidden"
        onChange={importScenario}
        type="file"
      />
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Industrial field service dispatch</p>
          <h1>FieldOps Dispatch Lab</h1>
          <div className="hero-stats" aria-label="Scenario overview">
            <StatPill icon={Users} label="Technicians" value={scenario.resources.length} />
            <StatPill icon={BriefcaseBusiness} label="Requests" value={scenario.requests.length} />
            <StatPill icon={MapPin} label="Region" value="Chicagoland" />
          </div>
        </div>
        <div className="hero-actions">
          <button
            className="primary-action"
            type="button"
            onClick={() => runComparison()}
            disabled={isRunning}
            title="Run optimizer"
          >
            <Activity size={18} />
            {isRunning ? "Optimizing" : "Run optimizer"}
          </button>
          <div className="status-chip">
            <Clock3 size={16} />
            {status}
          </div>
        </div>
      </header>

      <section className="impact-grid">
        <OutcomePanel winner={winner} comparison={comparison} />
        <ScenarioActions
          actions={scenarioActions}
          canExportResults={Boolean(results)}
          onAction={handleScenarioAction}
          onExportResults={exportResults}
          onExportScenario={exportScenario}
          onImportScenario={openScenarioImport}
        />
      </section>

      <section className="dashboard-grid">
        <section className="map-panel" aria-label="Spatial assignment map">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live map</p>
              <h2>{algorithmLabels[selectedAlgorithm]} dispatch plan</h2>
            </div>
            <div className="segmented" aria-label="Algorithm selector">
              {Object.keys(algorithmLabels).map((algorithm) => (
                <button
                  key={algorithm}
                  type="button"
                  className={selectedAlgorithm === algorithm ? "active" : ""}
                  onClick={() => setSelectedAlgorithm(algorithm)}
                >
                  {algorithmLabels[algorithm]}
                </button>
              ))}
            </div>
          </div>
          <DispatchMap
            resourceById={resourceById}
            result={selectedResult}
            scenario={scenario}
            selectedRequestId={selectedRequest?.id}
            setSelectedAlgorithm={setSelectedAlgorithm}
            setSelectedRequestId={setSelectedRequestId}
            mapTilesOk={mapTilesOk}
            setMapTilesOk={setMapTilesOk}
          />
        </section>

        <aside className="ops-panel">
          <SelectedRequestPanel
            request={selectedRequest}
            resourceById={resourceById}
            results={results}
          />
          <ControlsPanel
            config={scenario.config}
            isRunning={isRunning}
            runComparison={() => runComparison()}
            updateConfig={updateConfig}
          />
        </aside>
      </section>

      <section className="metrics-band">
        {Object.entries(results || {}).map(([algorithm, result]) => (
          <AlgorithmSummary
            key={algorithm}
            algorithm={algorithm}
            result={result}
            isWinner={winner?.algorithm === result.algorithm}
          />
        ))}
      </section>

      <section className="details-grid">
        <RequestsPanel
          requestById={requestById}
          resourceById={resourceById}
          scenario={scenario}
          selectedRequestId={selectedRequest?.id}
          selectedResult={selectedResult}
          setSelectedRequestId={setSelectedRequestId}
        />
        <AssignmentsPanel
          resourceById={resourceById}
          result={selectedResult}
          requestById={requestById}
          selectedAlgorithm={selectedAlgorithm}
        />
      </section>
    </main>
  );
}

function StatPill({ icon: Icon, label, value }) {
  return (
    <span className="stat-pill">
      <Icon size={16} />
      <b>{value}</b>
      {label}
    </span>
  );
}

function OutcomePanel({ winner, comparison }) {
  return (
    <section className="outcome-panel">
      <div>
        <p className="eyebrow">Recommendation</p>
        <h2>{winner ? `${algorithmLabels[winner.algorithm]} is the stronger plan` : "Waiting for optimizer"}</h2>
      </div>
      <div className="outcome-copy">
        <Sparkles size={22} />
        <p>
          {comparison
            ? `${comparison.priorityText}. ${comparison.travelText}. Objective delta: ${comparison.objectiveDelta}.`
            : "Run the optimizer to compare dispatch quality."}
        </p>
      </div>
    </section>
  );
}

function ScenarioActions({
  actions,
  canExportResults,
  onAction,
  onExportResults,
  onExportScenario,
  onImportScenario
}) {
  return (
    <section className="scenario-actions" aria-label="Scenario actions">
      {actions.map(({ id, label, icon: Icon, tone }) => (
        <button key={id} className={`scenario-action ${tone}`} type="button" onClick={() => onAction(id)}>
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
      <button className="scenario-action utility" type="button" onClick={onImportScenario}>
        <Upload size={18} />
        <span>Import Scenario</span>
      </button>
      <button className="scenario-action utility" type="button" onClick={onExportScenario}>
        <FileJson size={18} />
        <span>Export Scenario</span>
      </button>
      <button className="scenario-action utility wide" disabled={!canExportResults} type="button" onClick={onExportResults}>
        <Download size={18} />
        <span>Export Results</span>
      </button>
    </section>
  );
}

function DispatchMap({
  resourceById,
  result,
  scenario,
  selectedRequestId,
  setSelectedAlgorithm,
  setSelectedRequestId,
  mapTilesOk,
  setMapTilesOk
}) {
  const assignmentByRequest = useMemo(
    () => new Map((result?.assignments || []).map((item) => [item.request_id, item])),
    [result]
  );
  const bounds = useMemo(() => {
    const points = [
      ...scenario.resources.map((resource) => [resource.location.lat, resource.location.lon]),
      ...scenario.requests.map((request) => [request.location.lat, request.location.lon])
    ];
    return points.length ? points : [[41.8781, -87.6298]];
  }, [scenario.resources, scenario.requests]);

  return (
    <div className="map-shell">
      {!mapTilesOk ? (
        <div className="map-warning">
          <WifiOff size={17} />
          Map tiles are unavailable. Markers and assignment routes still work.
        </div>
      ) : null}
      <MapContainer className="dispatch-map" center={[41.8781, -87.6298]} zoom={9} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          eventHandlers={{
            tileerror: () => setMapTilesOk(false),
            tileload: () => setMapTilesOk(true)
          }}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />

        {(result?.assignments || []).map((assignment) => {
          const resource = resourceById.get(assignment.resource_id);
          const request = scenario.requests.find((item) => item.id === assignment.request_id);
          if (!resource || !request) return null;
          const isSelected = assignment.request_id === selectedRequestId;
          return (
            <Polyline
              key={`${assignment.resource_id}-${assignment.request_id}`}
              pathOptions={{
                color: isSelected ? "#f59e0b" : algorithmTone[result.algorithm],
                opacity: isSelected ? 0.95 : 0.64,
                weight: isSelected ? 5 : 3
              }}
              positions={[
                [resource.location.lat, resource.location.lon],
                [request.location.lat, request.location.lon]
              ]}
            >
              <Tooltip sticky>
                {resource.name} to {request.customer} · {assignment.travel_km.toFixed(1)} km
              </Tooltip>
            </Polyline>
          );
        })}

        {scenario.resources.map((resource) => (
          <CircleMarker
            key={resource.id}
            center={[resource.location.lat, resource.location.lon]}
            pathOptions={{ color: "#ffffff", fillColor: "#2563eb", fillOpacity: 0.95, weight: 2 }}
            radius={9}
          >
            <Popup>
              <MapPopupTitle title={resource.name} subtitle={resource.location.label} />
              <p className="popup-text">{resource.skills.join(", ")}</p>
            </Popup>
            <Tooltip direction="top">{resource.name}</Tooltip>
          </CircleMarker>
        ))}

        {scenario.requests.map((request) => {
          const isAssigned = assignmentByRequest.has(request.id);
          const isSelected = request.id === selectedRequestId;
          return (
            <CircleMarker
              key={request.id}
              center={[request.location.lat, request.location.lon]}
              eventHandlers={{ click: () => setSelectedRequestId(request.id) }}
              pathOptions={{
                color: isSelected ? "#111827" : "#ffffff",
                fillColor: isAssigned ? skillPalette[request.required_skill] || "#f97316" : "#dc2626",
                fillOpacity: 0.95,
                weight: isSelected ? 3 : 2
              }}
              radius={isSelected ? 12 : 9}
            >
              <Popup>
                <MapPopupTitle title={request.customer} subtitle={`P${request.priority} · ${request.required_skill}`} />
                <p className="popup-text">
                  {request.location.label} · {request.duration_minutes} min · {timeWindow(request)}
                </p>
                <button
                  className="popup-button"
                  type="button"
                  onClick={() => {
                    setSelectedAlgorithm(result?.algorithm || "hungarian");
                    setSelectedRequestId(request.id);
                  }}
                >
                  Inspect request
                </button>
              </Popup>
              <Tooltip direction="top">{request.customer}</Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-tech" /> Technicians</span>
        <span><i className="legend-assigned" /> Assigned requests</span>
        <span><i className="legend-open" /> Open requests</span>
      </div>
    </div>
  );
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [34, 34] });
    }
  }, [bounds, map]);
  return null;
}

function MapPopupTitle({ title, subtitle }) {
  return (
    <div className="popup-title">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}

function SelectedRequestPanel({ request, resourceById, results }) {
  const assignments = Object.entries(results || {}).map(([algorithm, result]) => ({
    algorithm,
    assignment: result.assignments.find((item) => item.request_id === request?.id),
    unassigned: result.unassigned.find((item) => item.request_id === request?.id)
  }));

  if (!request) return null;

  return (
    <section className="side-section">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Selected request</p>
          <h2>{request.customer}</h2>
        </div>
        <LocateFixed size={20} />
      </div>
      <div className="request-inspector">
        <div className="inspector-grid">
          <InfoTile label="Priority" value={`P${request.priority}`} />
          <InfoTile label="Skill" value={request.required_skill} />
          <InfoTile label="Window" value={timeWindow(request)} />
          <InfoTile label="Duration" value={`${request.duration_minutes} min`} />
        </div>
        <div className="algorithm-decisions">
          {assignments.map(({ algorithm, assignment, unassigned }) => {
            const resource = assignment ? resourceById.get(assignment.resource_id) : null;
            return (
              <article key={algorithm} className="decision-card">
                <strong style={{ color: algorithmTone[algorithm] }}>{algorithmLabels[algorithm]}</strong>
                {assignment ? (
                  <span>
                    {resource?.name} <ArrowRight size={13} /> {assignment.travel_km.toFixed(1)} km at{" "}
                    {formatTime(assignment.start_time)}
                  </span>
                ) : (
                  <span className="decision-open">{unassigned?.reason || "Unassigned"}</span>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ControlsPanel({ config, isRunning, runComparison, updateConfig }) {
  return (
    <section className="side-section">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Model controls</p>
          <h2>Scoring weights</h2>
        </div>
        <SlidersHorizontal size={20} />
      </div>
      <Slider label="Priority" value={config.priority_weight} min={10} max={80} step={1} onChange={(value) => updateConfig("priority_weight", value)} />
      <Slider label="Distance" value={config.distance_weight} min={0.25} max={4} step={0.25} onChange={(value) => updateConfig("distance_weight", value)} />
      <Slider label="Lateness" value={config.lateness_weight} min={0} max={2} step={0.1} onChange={(value) => updateConfig("lateness_weight", value)} />
      <Slider label="Max km" value={config.max_travel_km} min={25} max={100} step={1} onChange={(value) => updateConfig("max_travel_km", value)} />
      <button className="secondary-action full" type="button" onClick={runComparison} disabled={isRunning}>
        <GitCompareArrows size={17} />
        Re-run comparison
      </button>
    </section>
  );
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="slider-row">
      <span>
        {label}
        <strong>{Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function AlgorithmSummary({ algorithm, result, isWinner }) {
  return (
    <article className={`summary-panel ${isWinner ? "summary-panel--winner" : ""}`}>
      <div className="summary-title">
        <h2>{algorithmLabels[algorithm]}</h2>
        {isWinner ? <span className="winner-badge">Best tradeoff</span> : null}
      </div>
      <div className="metric-grid">
        {metricDefinitions.map(({ key, label, type, icon: Icon }) => (
          <div className="metric-tile" key={key}>
            <Icon size={18} />
            <span>{label}</span>
            <strong>{formatMetric(result.metrics[key], type)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RequestsPanel({
  requestById,
  resourceById,
  scenario,
  selectedRequestId,
  selectedResult,
  setSelectedRequestId
}) {
  const assignmentByRequest = new Map((selectedResult?.assignments || []).map((item) => [item.request_id, item]));
  const unassignedByRequest = new Map((selectedResult?.unassigned || []).map((item) => [item.request_id, item.reason]));
  const sortedRequests = scenario.requests.slice().sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.window_start.localeCompare(right.window_start);
  });

  return (
    <section className="list-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Demand queue</p>
          <h2>{algorithmLabels[selectedResult?.algorithm || "hungarian"]} request coverage</h2>
        </div>
        <AlertCircle size={19} />
      </div>
      <div className="request-table">
        {sortedRequests.map((request) => {
          const assignment = assignmentByRequest.get(request.id);
          const resource = assignment ? resourceById.get(assignment.resource_id) : null;
          return (
            <button
              className={`request-row ${selectedRequestId === request.id ? "selected" : ""}`}
              key={request.id}
              type="button"
              onClick={() => setSelectedRequestId(request.id)}
            >
              <div>
                <strong>{request.customer}</strong>
                <span>
                  P{request.priority} · {request.required_skill} · {request.location.label}
                </span>
              </div>
              <span className={assignment ? "state-pill assigned" : "state-pill open"}>
                {assignment ? "Assigned" : "Open"}
              </span>
              <p>
                {assignment
                  ? `${resource?.name} at ${formatTime(assignment.start_time)} · ${assignment.travel_km.toFixed(1)} km`
                  : unassignedByRequest.get(request.id)}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AssignmentsPanel({ resourceById, result, requestById, selectedAlgorithm }) {
  return (
    <section className="list-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Decision log</p>
          <h2>{algorithmLabels[selectedAlgorithm]} assignment rationale</h2>
        </div>
        <MapPin size={19} />
      </div>
      <div className="assignment-list">
        {(result?.assignments || []).map((assignment) => {
          const resource = resourceById.get(assignment.resource_id);
          const request = requestById.get(assignment.request_id);
          return (
            <article className="assignment-row" key={`${assignment.resource_id}-${assignment.request_id}`}>
              <div>
                <strong>{request?.customer}</strong>
                <span>
                  {resource?.name} · {formatTime(assignment.start_time)}-{formatTime(assignment.end_time)}
                </span>
              </div>
              <p>{assignment.explanation}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function pickWinner(results) {
  if (!results) return null;
  return Object.values(results).slice().sort((left, right) => {
    if (right.metrics.priority_served_rate !== left.metrics.priority_served_rate) {
      return right.metrics.priority_served_rate - left.metrics.priority_served_rate;
    }
    return left.metrics.objective_score - right.metrics.objective_score;
  })[0];
}

function buildComparison(results) {
  if (!results?.greedy || !results?.hungarian) return null;
  const greedy = results.greedy.metrics;
  const hungarian = results.hungarian.metrics;
  const priorityDelta = Math.round((hungarian.priority_served_rate - greedy.priority_served_rate) * 100);
  const travelDelta = hungarian.total_travel_km - greedy.total_travel_km;
  const objectiveDelta = hungarian.objective_score - greedy.objective_score;

  return {
    priorityText:
      priorityDelta === 0
        ? "Both plans serve the same weighted priority"
        : `Hungarian serves ${Math.abs(priorityDelta)} pts ${priorityDelta > 0 ? "more" : "less"} weighted priority`,
    travelText:
      Math.abs(travelDelta) < 0.1
        ? "Travel is effectively tied"
        : `Hungarian travels ${Math.abs(travelDelta).toFixed(1)} km ${travelDelta > 0 ? "more" : "less"}`,
    objectiveDelta: `${objectiveDelta > 0 ? "+" : ""}${objectiveDelta.toFixed(1)}`
  };
}

function timeWindow(request) {
  return `${formatTime(request.window_start)}-${formatTime(request.window_end)}`;
}

export default App;
