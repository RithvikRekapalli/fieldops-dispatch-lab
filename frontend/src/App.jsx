import {
  Activity,
  AlertCircle,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  Route,
  SlidersHorizontal,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const algorithmLabels = {
  greedy: "Greedy",
  hungarian: "Hungarian"
};

const metricDefinitions = [
  { key: "fill_rate", label: "Fill rate", type: "percent", icon: Gauge },
  { key: "priority_served_rate", label: "Priority served", type: "percent", icon: Activity },
  { key: "total_travel_km", label: "Travel km", type: "number", icon: Route },
  { key: "objective_score", label: "Objective", type: "number", icon: Navigation }
];

function formatMetric(value, type) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "n/a";
  }
  if (type === "percent") {
    return `${Math.round(value * 100)}%`;
  }
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
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
  const [scenario, setScenario] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("hungarian");
  const [status, setStatus] = useState("Loading scenario");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const nextScenario = await fetchJson("/api/scenario");
        setScenario(nextScenario);
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
    setStatus("Running allocation");
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
      config: {
        ...current.config,
        [key]: value
      }
    }));
  }

  const selectedResult = results?.[selectedAlgorithm];
  const winner = useMemo(() => {
    if (!results) return null;
    return Object.values(results).slice().sort((left, right) => {
      if (right.metrics.priority_served_rate !== left.metrics.priority_served_rate) {
        return right.metrics.priority_served_rate - left.metrics.priority_served_rate;
      }
      return left.metrics.objective_score - right.metrics.objective_score;
    })[0];
  }, [results]);

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
      <header className="topbar">
        <div>
          <p className="eyebrow">Field service dispatch</p>
          <h1>FieldOps Dispatch Lab</h1>
        </div>
        <button
          className="primary-action"
          type="button"
          onClick={() => runComparison()}
          disabled={isRunning}
          title="Run comparison"
        >
          <Activity size={18} />
          {isRunning ? "Running" : "Run comparison"}
        </button>
      </header>

      <section className="dashboard-grid">
        <section className="map-panel" aria-label="Spatial assignment map">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Spatial view</p>
              <h2>{algorithmLabels[selectedAlgorithm]} assignments</h2>
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
          <MapView scenario={scenario} result={selectedResult} />
        </section>

        <aside className="control-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Parameters</p>
              <h2>Scoring weights</h2>
            </div>
            <SlidersHorizontal size={20} />
          </div>
          <Slider
            label="Priority"
            value={scenario.config.priority_weight}
            min={10}
            max={80}
            step={1}
            onChange={(value) => updateConfig("priority_weight", value)}
          />
          <Slider
            label="Distance"
            value={scenario.config.distance_weight}
            min={0.25}
            max={4}
            step={0.25}
            onChange={(value) => updateConfig("distance_weight", value)}
          />
          <Slider
            label="Lateness"
            value={scenario.config.lateness_weight}
            min={0}
            max={2}
            step={0.1}
            onChange={(value) => updateConfig("lateness_weight", value)}
          />
          <Slider
            label="Max km"
            value={scenario.config.max_travel_km}
            min={25}
            max={100}
            step={1}
            onChange={(value) => updateConfig("max_travel_km", value)}
          />
          <div className="status-row">
            <Clock3 size={18} />
            <span>{status}</span>
          </div>
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
        <AssignmentsPanel
          title={`${algorithmLabels[selectedAlgorithm]} assignment explanations`}
          scenario={scenario}
          result={selectedResult}
        />
        <RequestsPanel scenario={scenario} result={selectedResult} />
      </section>
    </main>
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

function MapView({ scenario, result }) {
  const assignmentByRequest = useMemo(() => {
    return new Map((result?.assignments || []).map((item) => [item.request_id, item]));
  }, [result]);

  const resourceById = useMemo(() => {
    return new Map(scenario.resources.map((resource) => [resource.id, resource]));
  }, [scenario.resources]);

  const points = [
    ...scenario.resources.map((resource) => resource.location),
    ...scenario.requests.map((request) => request.location)
  ];
  const bounds = getBounds(points);
  const project = (location) => projectPoint(location, bounds);

  return (
    <div className="map-shell">
      <svg className="dispatch-map" viewBox="0 0 1000 620" role="img">
        <defs>
          <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
            <path d="M 52 0 L 0 0 0 52" fill="none" stroke="#d9e2ec" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="1000" height="620" fill="#f8fafc" />
        <rect width="1000" height="620" fill="url(#grid)" opacity="0.75" />

        {(result?.assignments || []).map((assignment) => {
          const resource = resourceById.get(assignment.resource_id);
          const request = scenario.requests.find((item) => item.id === assignment.request_id);
          if (!resource || !request) return null;
          const start = project(resource.location);
          const end = project(request.location);
          return (
            <g key={`${assignment.resource_id}-${assignment.request_id}`}>
              <line
                className="assignment-line"
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
              <circle className="line-dot" cx={(start.x + end.x) / 2} cy={(start.y + end.y) / 2} r="4" />
            </g>
          );
        })}

        {scenario.resources.map((resource) => {
          const point = project(resource.location);
          return (
            <g className="resource-marker" key={resource.id} transform={`translate(${point.x} ${point.y})`}>
              <circle r="14" />
              <text y="5">{resource.name.split(" ")[0][0]}</text>
              <title>{`${resource.name}: ${resource.skills.join(", ")}`}</title>
            </g>
          );
        })}

        {scenario.requests.map((request) => {
          const point = project(request.location);
          const isAssigned = assignmentByRequest.has(request.id);
          return (
            <g
              className={`request-marker ${isAssigned ? "assigned" : "unassigned"}`}
              key={request.id}
              transform={`translate(${point.x} ${point.y})`}
            >
              <rect x="-11" y="-11" width="22" height="22" rx="4" />
              <text y="5">{request.priority}</text>
              <title>{`${request.customer}: priority ${request.priority}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="map-legend">
        <span><i className="legend-resource" /> Technicians</span>
        <span><i className="legend-request" /> Assigned requests</span>
        <span><i className="legend-unassigned" /> Unassigned requests</span>
      </div>
    </div>
  );
}

function getBounds(points) {
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  };
}

function projectPoint(location, bounds) {
  const pad = 70;
  const width = 1000 - pad * 2;
  const height = 620 - pad * 2;
  const lonSpan = Math.max(0.001, bounds.maxLon - bounds.minLon);
  const latSpan = Math.max(0.001, bounds.maxLat - bounds.minLat);
  return {
    x: pad + ((location.lon - bounds.minLon) / lonSpan) * width,
    y: pad + ((bounds.maxLat - location.lat) / latSpan) * height
  };
}

function AssignmentsPanel({ title, scenario, result }) {
  const resourceById = new Map(scenario.resources.map((resource) => [resource.id, resource]));
  const requestById = new Map(scenario.requests.map((request) => [request.id, request]));

  return (
    <section className="list-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Decision log</p>
          <h2>{title}</h2>
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
                <span>{resource?.name} at {assignment.start_time.slice(11)}</span>
              </div>
              <p>{assignment.explanation}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RequestsPanel({ scenario, result }) {
  const assignedIds = new Set((result?.assignments || []).map((item) => item.request_id));
  const unassignedReasonById = new Map((result?.unassigned || []).map((item) => [item.request_id, item.reason]));

  return (
    <section className="list-panel">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Demand queue</p>
          <h2>Requests</h2>
        </div>
        <AlertCircle size={19} />
      </div>
      <div className="request-table">
        {scenario.requests.map((request) => (
          <article className="request-row" key={request.id}>
            <div>
              <strong>{request.customer}</strong>
              <span>{request.required_skill} | priority {request.priority}</span>
            </div>
            <span className={assignedIds.has(request.id) ? "state-pill assigned" : "state-pill open"}>
              {assignedIds.has(request.id) ? "Assigned" : "Open"}
            </span>
            {!assignedIds.has(request.id) ? (
              <p>{unassignedReasonById.get(request.id)}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export default App;
